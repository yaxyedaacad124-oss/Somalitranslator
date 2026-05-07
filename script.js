/**
 * ═══════════════════════════════════════════════════════
 *  LinguaLocal — Frontend Script
 *  script.js  |  Vanilla JavaScript (ES2020+)
 * ═══════════════════════════════════════════════════════
 *
 *  Communicates with the local Express server at :3000
 *  All features work fully offline — no external CDNs used.
 *
 *  Features:
 *   - Translate via POST /translate
 *   - Language swap
 *   - Dark / Light theme toggle (persisted in localStorage)
 *   - Char counter + live label updates
 *   - History drawer (load from GET /history, clear via DELETE)
 *   - Quick-phrase chips
 *   - Copy to clipboard with toast
 *   - Loading shimmer + button loader state
 *   - Error banner with dismiss
 *   - RTL support for Arabic
 */

'use strict';

/* ── API ──────────────────────────────────────────────── */
const API_BASE = 'http://localhost:3000';

/* ── Language Metadata ────────────────────────────────── */
const LANGUAGES = {
  en: { name: 'English',  flag: '🇬🇧', rtl: false },
  so: { name: 'Somali',   flag: '🇸🇴', rtl: false },
  ar: { name: 'Arabic',   flag: '🇸🇦', rtl: true  },
  fr: { name: 'French',   flag: '🇫🇷', rtl: false },
};

/* ── DOM References ───────────────────────────────────── */
const $ = id => document.getElementById(id);

const sourceLangEl    = $('sourceLang');
const targetLangEl    = $('targetLang');
const sourceTextEl    = $('sourceText');
const outputTextEl    = $('outputText');
const translateBtn    = $('translateBtn');
const btnLoader       = translateBtn.querySelector('.btn-loader');
const btnInner        = translateBtn.querySelector('.btn-translate-inner');
const swapBtn         = $('swapLangs');
const clearBtn        = $('clearBtn');
const copyBtn         = $('copyBtn');
const charCountEl     = $('charCount');
const sourcePanelLabel = $('sourcePanelLabel');
const targetPanelLabel = $('targetPanelLabel');
const statusBanner    = $('statusBanner');
const statusText      = $('statusText');
const dismissStatus   = $('dismissStatus');
const themeToggle     = $('themeToggle');
const iconMoon        = themeToggle.querySelector('.icon-moon');
const iconSun         = themeToggle.querySelector('.icon-sun');
const historyToggle   = $('historyToggle');
const historyDrawer   = $('historyDrawer');
const drawerOverlay   = $('drawerOverlay');
const closeHistory    = $('closeHistory');
const clearHistory    = $('clearHistory');
const historyList     = $('historyList');
const quickPhrases    = $('quickPhrases');
const wordCountMeta   = $('wordCountMeta');
const timeMeta        = $('timeMeta');
const translationMeta = $('translationMeta');
const copyToast       = $('copyToast');

/* ── State ────────────────────────────────────────────── */
let currentTranslation = ''; // last successful translation result
let toastTimer = null;       // timer for hiding the copy toast

/* ═══════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════ */

/**
 * Applies the given theme ('dark' | 'light') to the body
 * and updates the toggle button icons.
 */
function applyTheme(theme) {
  document.body.classList.toggle('dark',  theme === 'dark');
  document.body.classList.toggle('light', theme === 'light');
  iconMoon.classList.toggle('hidden', theme === 'light');
  iconSun.classList.toggle('hidden',  theme === 'dark');
  localStorage.setItem('lingua-theme', theme);
}

// Restore saved theme on page load (defaults to dark)
applyTheme(localStorage.getItem('lingua-theme') || 'dark');

themeToggle.addEventListener('click', () => {
  const next = document.body.classList.contains('dark') ? 'light' : 'dark';
  applyTheme(next);
});

/* ═══════════════════════════════════════════════════════
   LANGUAGE SELECTION HELPERS
═══════════════════════════════════════════════════════ */

/** Update the panel header labels to match the selected languages. */
function updatePanelLabels() {
  const src = sourceLangEl.value;
  const tgt = targetLangEl.value;
  sourcePanelLabel.textContent = LANGUAGES[src]?.name ?? src;
  targetPanelLabel.textContent = LANGUAGES[tgt]?.name ?? tgt;
}

/** If user picks the same language for source and target, auto-fix the conflict. */
function resolveLanguageConflict(changedEl, otherEl) {
  if (changedEl.value === otherEl.value) {
    // Choose first available option that differs
    const available = [...otherEl.options].find(o => o.value !== changedEl.value);
    if (available) otherEl.value = available.value;
  }
  updatePanelLabels();
}

sourceLangEl.addEventListener('change', () => resolveLanguageConflict(sourceLangEl, targetLangEl));
targetLangEl.addEventListener('change', () => resolveLanguageConflict(targetLangEl, sourceLangEl));

/** Swap source ↔ target language selectors (and optionally the text too). */
swapBtn.addEventListener('click', () => {
  const srcLang = sourceLangEl.value;
  const tgtLang = targetLangEl.value;

  sourceLangEl.value = tgtLang;
  targetLangEl.value = srcLang;

  // Also swap text content if there is a current translation
  if (currentTranslation) {
    sourceTextEl.value = currentTranslation;
    updateCharCount();
    clearOutput();
  }

  updatePanelLabels();
});

// Init labels on load
updatePanelLabels();

/* ═══════════════════════════════════════════════════════
   CHARACTER COUNTER
═══════════════════════════════════════════════════════ */

function updateCharCount() {
  const count = sourceTextEl.value.length;
  charCountEl.textContent = `${count} / 2000`;
  // Warn visually when getting close to limit
  charCountEl.style.color = count > 1800 ? 'var(--warning)' : 'var(--text-muted)';
}

sourceTextEl.addEventListener('input', updateCharCount);

/* ═══════════════════════════════════════════════════════
   CLEAR
═══════════════════════════════════════════════════════ */

clearBtn.addEventListener('click', () => {
  sourceTextEl.value = '';
  updateCharCount();
  clearOutput();
  hideError();
  sourceTextEl.focus();
});

function clearOutput() {
  outputTextEl.innerHTML = '<span class="output-placeholder">Translation will appear here…</span>';
  outputTextEl.classList.remove('rtl');
  copyBtn.disabled = true;
  currentTranslation = '';
  translationMeta.style.display = 'none';
}

/* ═══════════════════════════════════════════════════════
   ERROR BANNER
═══════════════════════════════════════════════════════ */

function showError(msg) {
  statusText.textContent = msg;
  statusBanner.classList.remove('hidden');
}
function hideError() {
  statusBanner.classList.add('hidden');
}

dismissStatus.addEventListener('click', hideError);

/* ═══════════════════════════════════════════════════════
   LOADING STATE
═══════════════════════════════════════════════════════ */

function setLoading(loading) {
  translateBtn.disabled = loading;
  btnInner.classList.toggle('hidden', loading);
  btnLoader.classList.toggle('hidden', !loading);

  if (loading) {
    // Show shimmer lines in the output panel while waiting
    outputTextEl.innerHTML = `
      <div class="shimmer" style="width:80%"></div>
      <div class="shimmer" style="width:60%; margin-top:8px"></div>
      <div class="shimmer" style="width:70%; margin-top:8px"></div>
    `;
  }
}

/* ═══════════════════════════════════════════════════════
   TRANSLATE
═══════════════════════════════════════════════════════ */

async function translate() {
  const text = sourceTextEl.value.trim();
  const sourceLang = sourceLangEl.value;
  const targetLang = targetLangEl.value;

  // Guard: empty input
  if (!text) {
    showError('Please enter some text to translate.');
    sourceTextEl.focus();
    return;
  }

  hideError();
  setLoading(true);

  try {
    const response = await fetch(`${API_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang, targetLang })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Translation failed. Please try again.');
    }

    // ── Render the translation ──────────────────────────
    currentTranslation = data.translatedText;
    outputTextEl.textContent = data.translatedText;

    // Apply RTL for Arabic output
    if (LANGUAGES[targetLang]?.rtl) {
      outputTextEl.classList.add('rtl');
    } else {
      outputTextEl.classList.remove('rtl');
    }

    // Enable copy button
    copyBtn.disabled = false;

    // Show metadata chips
    wordCountMeta.textContent = `${data.wordCount} word${data.wordCount !== 1 ? 's' : ''}`;
    timeMeta.textContent = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    translationMeta.style.display = 'flex';

  } catch (err) {
    // Network error (server not running) vs API error
    const msg = err.message.includes('Failed to fetch')
      ? '❌ Cannot connect to server. Make sure you ran: node server.js'
      : `❌ ${err.message}`;
    showError(msg);
    clearOutput();
  } finally {
    setLoading(false);
  }
}

// Translate on button click
translateBtn.addEventListener('click', translate);

// Translate on Ctrl+Enter / Cmd+Enter
sourceTextEl.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    translate();
  }
});

/* ═══════════════════════════════════════════════════════
   COPY TO CLIPBOARD
═══════════════════════════════════════════════════════ */

copyBtn.addEventListener('click', async () => {
  if (!currentTranslation) return;
  try {
    await navigator.clipboard.writeText(currentTranslation);
    showToast();
  } catch {
    // Fallback for older browsers / insecure contexts
    const ta = document.createElement('textarea');
    ta.value = currentTranslation;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast();
  }
});

function showToast() {
  copyToast.classList.remove('hidden');
  // Force reflow to restart animation
  void copyToast.offsetWidth;
  copyToast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    copyToast.classList.remove('show');
    setTimeout(() => copyToast.classList.add('hidden'), 400);
  }, 2200);
}

/* ═══════════════════════════════════════════════════════
   QUICK PHRASES
═══════════════════════════════════════════════════════ */

quickPhrases.addEventListener('click', e => {
  const chip = e.target.closest('.quick-chip');
  if (!chip) return;
  sourceTextEl.value = chip.dataset.phrase;
  updateCharCount();
  hideError();
  // Auto-translate immediately
  translate();
});

/* ═══════════════════════════════════════════════════════
   HISTORY DRAWER
═══════════════════════════════════════════════════════ */

function openHistoryDrawer() {
  historyDrawer.hidden = false;
  // Trigger CSS animation on next frame
  requestAnimationFrame(() => {
    historyDrawer.classList.add('open');
    drawerOverlay.classList.remove('hidden');
  });
  loadHistory();
}

function closeHistoryDrawer() {
  historyDrawer.classList.remove('open');
  drawerOverlay.classList.add('hidden');
  // Hide after animation completes
  setTimeout(() => { historyDrawer.hidden = true; }, 400);
}

historyToggle.addEventListener('click', openHistoryDrawer);
closeHistory.addEventListener('click', closeHistoryDrawer);
drawerOverlay.addEventListener('click', closeHistoryDrawer);

/**
 * Fetches the translation history from the server and renders it.
 */
async function loadHistory() {
  historyList.innerHTML = '<div class="history-empty">Loading…</div>';
  try {
    const res = await fetch(`${API_BASE}/history`);
    const data = await res.json();

    if (!data.history || data.history.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No translations yet.</div>';
      return;
    }

    historyList.innerHTML = '';
    data.history.forEach(item => {
      const srcName = LANGUAGES[item.sourceLang]?.name ?? item.sourceLang;
      const tgtName = LANGUAGES[item.targetLang]?.name ?? item.targetLang;
      const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="history-langs">${srcName} → ${tgtName}</div>
        <div class="history-original">${escapeHtml(item.originalText)}</div>
        <div class="history-translated">${escapeHtml(item.translatedText)}</div>
        <div class="history-time">${time}</div>
      `;

      // Clicking a history item re-populates the translator
      el.addEventListener('click', () => {
        sourceLangEl.value = item.sourceLang;
        targetLangEl.value = item.targetLang;
        sourceTextEl.value = item.originalText;
        updatePanelLabels();
        updateCharCount();
        closeHistoryDrawer();
        // Show the existing translation immediately without re-fetching
        currentTranslation = item.translatedText;
        outputTextEl.textContent = item.translatedText;
        if (LANGUAGES[item.targetLang]?.rtl) {
          outputTextEl.classList.add('rtl');
        } else {
          outputTextEl.classList.remove('rtl');
        }
        copyBtn.disabled = false;
        translationMeta.style.display = 'flex';
        timeMeta.textContent = time;
        const wc = item.originalText.trim().split(/\s+/).filter(Boolean).length;
        wordCountMeta.textContent = `${wc} word${wc !== 1 ? 's' : ''}`;
      });

      historyList.appendChild(el);
    });

  } catch {
    historyList.innerHTML = '<div class="history-empty">Could not load history.</div>';
  }
}

clearHistory.addEventListener('click', async () => {
  try {
    await fetch(`${API_BASE}/history`, { method: 'DELETE' });
    historyList.innerHTML = '<div class="history-empty">History cleared.</div>';
  } catch {
    historyList.innerHTML = '<div class="history-empty">Could not clear history.</div>';
  }
});

/* ═══════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════ */

/** Escapes HTML special characters to prevent XSS when inserting user text. */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ── Init ─────────────────────────────────────────────── */
// Set initial char count display
updateCharCount();

console.log('%c🌍 LinguaLocal', 'font-size:18px; font-weight:bold; color:#a78bfa;');
console.log('Offline translator running. API:', API_BASE);
