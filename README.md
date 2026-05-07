# 🌍 LinguaLocal — Offline Language Translator

A fully offline language translator web app built with Node.js + Express and vanilla JavaScript.  
No internet connection required after initial setup.

---

## ✨ Features

- **4 languages**: English 🇬🇧 · Somali 🇸🇴 · Arabic 🇸🇦 · French 🇫🇷
- **Glassmorphism UI** with dark/light mode toggle
- **Greedy phrase matching** — translates multi-word phrases intelligently
- **Quick-phrase chips** for instant common translations
- **Translation history** — stored in memory, viewable in side drawer
- **Copy to clipboard** with toast notification
- **RTL support** for Arabic output
- **Responsive** — works on mobile and desktop
- **Ctrl+Enter** keyboard shortcut to translate

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
node server.js

# 3. Open your browser
# Visit: http://localhost:3000
```

---

## 📁 Project Structure

```
translator-app/
├── server.js          ← Express backend, translation logic
├── package.json
├── README.md
├── data/
│   └── dictionary.json  ← All translation data (600+ entries)
└── public/
    ├── index.html       ← App shell
    ├── style.css        ← Glassmorphism styles
    └── script.js        ← Frontend logic
```

---

## 🔌 API Endpoints

| Method | Endpoint     | Description                        |
|--------|--------------|------------------------------------|
| POST   | `/translate` | Translate text between languages   |
| GET    | `/history`   | Get recent translation history     |
| DELETE | `/history`   | Clear translation history          |
| GET    | `/languages` | List supported languages and pairs |

### POST /translate

**Request body:**
```json
{
  "text": "hello",
  "sourceLang": "en",
  "targetLang": "so"
}
```

**Response:**
```json
{
  "success": true,
  "translatedText": "salaan",
  "sourceLang": "en",
  "targetLang": "so",
  "originalText": "hello",
  "characterCount": 5,
  "wordCount": 1,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## 🧠 How Translation Works

1. The dictionary (`data/dictionary.json`) stores phrase pairs per language pair (e.g. `"en-so"`)
2. On each request, the backend tries a **full-phrase match** first
3. If no full match, it splits the input into sentences and applies **greedy longest-phrase matching** (up to 6 words at a time)
4. Unknown words are returned **as-is** wrapped in `[brackets]`
5. Articles and empty-string entries are silently dropped

---

## 🗣️ Supported Language Pairs

- English ↔ Somali
- English ↔ Arabic  
- English ↔ French

> To add more languages or words, edit `data/dictionary.json` and restart the server.

---

## ⌨️ Keyboard Shortcut

- **Ctrl+Enter** (or **Cmd+Enter** on Mac) — translate immediately

---

## 📦 Dependencies

- [express](https://expressjs.com/) — minimal web framework (only dependency)
