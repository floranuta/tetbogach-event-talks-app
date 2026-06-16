# BigQuery Release Notes Viewer & Tweet Poster

A premium, modern web application built with Python Flask, vanilla HTML5, CSS3, and JavaScript. The application fetches, parses, and displays Google Cloud BigQuery release notes, allowing you to filter updates by categories and quickly compose X (formerly Twitter) draft posts for individual updates.

---

## 🚀 Features

- **Granular Update Cards**: Splits daily multi-topic release notes into individual, category-specific update cards.
- **Interactive Search & Filters**: Live search over update content and dynamic category filter tags (Feature, Fix, Issue, Preview, Deprecation, etc.).
- **Rich Motion Design**: Glassmorphism aesthetic featuring smooth transitions, skeleton loading states, and a rotating refresh spinner.
- **Dynamic Tweet Composer**: Word-boundary truncation to fit within X (Twitter) limits, complete with a live character counter and direct integration with X Web Intent.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12+, Flask, XML processing (`xml.etree.ElementTree`)
- **Frontend**: Vanilla HTML5, CSS3 (Custom properties, grid, flexbox, `@keyframes`), Vanilla JS (Async/Await fetch, custom Event Listeners)

---

## 📂 Project Structure

```text
bq-release-notes/
├── app.py             # Flask server & XML feed parser
├── requirements.txt   # Python dependencies
├── .gitignore         # Git ignore patterns
├── README.md          # Project documentation
├── templates/
│   └── index.html     # Single Page App layout
└── static/
    ├── css/
    │   └── style.css  # Global styles & animation tokens
    └── js/
        └── script.js  # Frontend controller and API integration
```

---

## ⚙️ Installation & Running Locally

Follow these steps to run the application on your local machine:

### 1. Clone/Navigate to the Project Directory
```bash
cd bq-release-notes
```

### 2. Set Up a Virtual Environment (Optional but Recommended)
```bash
python -m venv .venv
# Activate on Windows:
.venv\Scripts\activate
# Activate on macOS/Linux:
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Flask Server
```bash
python app.py
```
By default, the server will start in development mode at **`http://127.0.0.1:5000`**.

---

## 🛠️ GitHub CLI Integration

This repository is fully integrated with GitHub. You can create repositories and push changes using the GitHub CLI:

1. Authenticate with GitHub (if not already logged in):
   ```bash
   gh auth login
   ```
2. Create and push your repository:
   ```bash
   gh repo create tetbogach-event-talks-app --public --source=. --push
   ```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
