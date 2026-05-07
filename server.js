/**
 * ═══════════════════════════════════════════════════════
 *  OFFLINE LANGUAGE TRANSLATOR — Backend Server
 *  server.js  |  Node.js + Express
 * ═══════════════════════════════════════════════════════
 *
 *  Runs fully offline — no external API calls needed.
 *  All translation is handled via a local JSON dictionary.
 *
 *  Start with:  node server.js
 *  API base:    http://localhost:3000
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ── Middleware ──────────────────────────────────────────
app.use(express.json());                          // parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // serve frontend files

// ── Load Dictionary ─────────────────────────────────────
// We load the dictionary once at startup for performance.
// Structure: { "en-so": { "hello": "salaan", ... }, ... }
let dictionary = {};
try {
  const dictPath = path.join(__dirname, 'data', 'dictionary.json');
  const rawData = fs.readFileSync(dictPath, 'utf-8');
  dictionary = JSON.parse(rawData);
  console.log('✅  Dictionary loaded successfully.');
  console.log(`📚  Language pairs available: ${Object.keys(dictionary).join(', ')}`);
} catch (err) {
  console.error('❌  Failed to load dictionary:', err.message);
  process.exit(1); // can't run without the dictionary
}

// ── In-Memory Translation History ───────────────────────
// Stores up to MAX_HISTORY recent translation requests.
const MAX_HISTORY = 50;
const translationHistory = [];

/**
 * translateText(text, sourceLang, targetLang)
 *
 * Core translation logic. Uses a greedy longest-phrase-first
 * matching strategy so "good morning" beats "good" + "morning".
 *
 * Algorithm:
 *  1. Build the dictionary key (e.g. "en-so")
 *  2. Check if the entire input matches a phrase → return early
 *  3. Otherwise split by sentence punctuation and translate each sentence
 *  4. Within a sentence, greedily match the longest known phrase first
 *  5. Unknown words are returned as-is, wrapped in [brackets]
 */
function translateText(text, sourceLang, targetLang) {
  // Same language → return as-is
  if (sourceLang === targetLang) return text;

  const dictKey = `${sourceLang}-${targetLang}`;
  const langDict = dictionary[dictKey];

  if (!langDict) {
    // No dictionary for this pair
    return null; // signals "unsupported pair" to the route handler
  }

  // Normalise to lowercase for matching (preserve original for unknowns)
  const lowerText = text.toLowerCase().trim();

  // ── 1. Full-phrase match (most common for short inputs) ──
  if (langDict[lowerText] !== undefined) {
    return langDict[lowerText];
  }

  // ── 2. Sentence-level translation ───────────────────────
  // Split on sentence-ending punctuation, keeping the delimiter
  const sentences = text.split(/([.!?،؟]+)/);
  const translatedSentences = [];

  for (let i = 0; i < sentences.length; i++) {
    const segment = sentences[i];

    // If this chunk is pure punctuation, carry it straight through
    if (/^[.!?،؟]+$/.test(segment.trim())) {
      translatedSentences.push(segment);
      continue;
    }

    if (!segment.trim()) continue;

    // ── 3. Greedy phrase matching within a sentence ──────
    const words = segment.trim().split(/\s+/);
    const translatedWords = [];
    let i2 = 0;

    while (i2 < words.length) {
      let matched = false;

      // Try longest possible phrase first (up to 6 words)
      const maxPhraseLen = Math.min(6, words.length - i2);

      for (let phraseLen = maxPhraseLen; phraseLen >= 1; phraseLen--) {
        const phrase = words.slice(i2, i2 + phraseLen).join(' ').toLowerCase();
        const translation = langDict[phrase];

        if (translation !== undefined) {
          // Empty-string translations (e.g. articles like "the", "a")
          // are intentionally dropped
          if (translation !== '') {
            translatedWords.push(translation);
          }
          i2 += phraseLen;
          matched = true;
          break;
        }
      }

      // Word not found → keep original, wrapped in brackets to signal unknown
      if (!matched) {
        translatedWords.push(`[${words[i2]}]`);
        i2++;
      }
    }

    translatedSentences.push(translatedWords.join(' '));
  }

  return translatedSentences.join('').trim();
}

// ════════════════════════════════════════════════════════
//  ROUTES
// ════════════════════════════════════════════════════════

/**
 * POST /translate
 *
 * Request body:
 *   { text: string, sourceLang: string, targetLang: string }
 *
 * Response (success):
 *   { success: true, translatedText: string, sourceLang, targetLang,
 *     originalText, characterCount, wordCount, timestamp }
 *
 * Response (error):
 *   { success: false, error: string }
 */
app.post('/translate', (req, res) => {
  const { text, sourceLang, targetLang } = req.body;

  // ── Input Validation ────────────────────────────────
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ success: false, error: 'No text provided.' });
  }
  if (!sourceLang || !targetLang) {
    return res.status(400).json({ success: false, error: 'Source and target languages are required.' });
  }
  if (text.trim().length > 2000) {
    return res.status(400).json({ success: false, error: 'Text exceeds the 2 000-character limit.' });
  }

  // ── Perform Translation ─────────────────────────────
  const result = translateText(text.trim(), sourceLang, targetLang);

  if (result === null) {
    return res.status(400).json({
      success: false,
      error: `Translation pair "${sourceLang} → ${targetLang}" is not supported.`
    });
  }

  // ── Save to History ─────────────────────────────────
  const entry = {
    id: Date.now(),
    originalText: text.trim(),
    translatedText: result,
    sourceLang,
    targetLang,
    timestamp: new Date().toISOString()
  };

  translationHistory.unshift(entry); // newest first
  if (translationHistory.length > MAX_HISTORY) {
    translationHistory.pop(); // evict oldest
  }

  // ── Respond ─────────────────────────────────────────
  return res.json({
    success: true,
    translatedText: result,
    sourceLang,
    targetLang,
    originalText: text.trim(),
    characterCount: text.trim().length,
    wordCount: text.trim().split(/\s+/).filter(Boolean).length,
    timestamp: entry.timestamp
  });
});

/**
 * GET /history
 *
 * Returns up to MAX_HISTORY recent translations.
 */
app.get('/history', (req, res) => {
  res.json({ success: true, history: translationHistory });
});

/**
 * DELETE /history
 *
 * Clears the in-memory history.
 */
app.delete('/history', (req, res) => {
  translationHistory.length = 0;
  res.json({ success: true, message: 'History cleared.' });
});

/**
 * GET /languages
 *
 * Returns a list of all supported language codes and their display names.
 */
app.get('/languages', (req, res) => {
  const languageNames = {
    en: 'English',
    so: 'Somali',
    ar: 'Arabic',
    fr: 'French'
  };

  // Derive available languages from dictionary keys
  const pairs = Object.keys(dictionary);
  const langSet = new Set();
  pairs.forEach(pair => {
    const [src, tgt] = pair.split('-');
    langSet.add(src);
    langSet.add(tgt);
  });

  const languages = [...langSet].map(code => ({
    code,
    name: languageNames[code] || code.toUpperCase()
  }));

  res.json({ success: true, languages, pairs });
});

// ── 404 fallback for unknown API routes ─────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found.' });
});

// ── Start Server ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌍  Offline Translator running at http://localhost:${PORT}`);
  console.log(`📖  Open your browser and visit: http://localhost:${PORT}\n`);
});
