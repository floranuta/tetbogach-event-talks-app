import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from flask import Flask, jsonify, render_template
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
ATOM_NS = "http://www.w3.org/2005/Atom"

# Category keywords → badge label mapping (order matters: first match wins)
CATEGORY_PATTERNS = [
    (re.compile(r"<h3[^>]*>\s*Breaking\s*[Cc]hange", re.I), "Breaking Change"),
    (re.compile(r"<h3[^>]*>\s*Deprecat", re.I),             "Deprecation"),
    (re.compile(r"<h3[^>]*>\s*Issue",    re.I),              "Issue"),
    (re.compile(r"<h3[^>]*>\s*Fix",      re.I),              "Fix"),
    (re.compile(r"<h3[^>]*>\s*Announc",  re.I),              "Announcement"),
    (re.compile(r"<h3[^>]*>\s*Preview",  re.I),              "Preview"),
    (re.compile(r"<h3[^>]*>\s*Feature",  re.I),              "Feature"),
    (re.compile(r"<h3[^>]*>\s*Changed",  re.I),              "Changed"),
]

def extract_categories(html: str) -> list[str]:
    """Return a deduplicated ordered list of category labels found in the entry HTML."""
    seen = set()
    cats = []
    for pattern, label in CATEGORY_PATTERNS:
        if pattern.search(html) and label not in seen:
            seen.add(label)
            cats.append(label)
    return cats or ["Update"]


def html_to_plain(html: str, max_chars: int = 280) -> str:
    """Strip tags, collapse whitespace, and truncate cleanly at a word boundary for a tweet."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_chars:
        return text
    
    truncated = text[:max_chars - 1]
    # Find last space within the last 30 characters of the truncated string
    last_space = truncated.rfind(' ')
    if last_space > max_chars - 30:
        truncated = truncated[:last_space]
    return truncated.rstrip() + "…"


def clean_category(cat_text: str) -> str:
    """Map raw category text inside h3 to standardized label using existing patterns."""
    cat_text_clean = cat_text.strip()
    for pattern, label in CATEGORY_PATTERNS:
        if pattern.search(f"<h3>{cat_text_clean}</h3>"):
            return label
    return cat_text_clean or "Update"


def parse_feed(xml_bytes: bytes) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    updates = []

    for entry in root.findall(f"{{{ATOM_NS}}}entry"):
        title_el   = entry.find(f"{{{ATOM_NS}}}title")
        updated_el = entry.find(f"{{{ATOM_NS}}}updated")
        link_el    = entry.find(f"{{{ATOM_NS}}}link[@rel='alternate']")
        content_el = entry.find(f"{{{ATOM_NS}}}content")
        id_el      = entry.find(f"{{{ATOM_NS}}}id")

        title   = title_el.text.strip()   if title_el   is not None else "Untitled"
        updated = updated_el.text.strip() if updated_el is not None else ""
        link    = link_el.get("href", "") if link_el    is not None else ""
        content = content_el.text or ""   if content_el is not None else ""
        entry_id = id_el.text.strip()     if id_el      is not None else ""

        # Parse the date for a nicer display
        try:
            dt = datetime.fromisoformat(updated).astimezone(timezone.utc)
            friendly_date = dt.strftime("%B %d, %Y")
            iso_date      = dt.strftime("%Y-%m-%d")
        except Exception:
            friendly_date = title
            iso_date      = ""

        content_stripped = content.strip()
        if not content_stripped:
            continue

        # Split content on <h3> elements
        parts = re.split(r'(?i)<h3[^>]*>(.*?)</h3>', content_stripped)
        
        entry_updates = []
        # Any text before the first <h3>
        initial_text = parts[0].strip()
        if initial_text:
            entry_updates.append(("Update", initial_text))

        # Pairs of (category, body)
        for i in range(1, len(parts), 2):
            if i + 1 < len(parts):
                raw_cat = parts[i].strip()
                body = parts[i+1].strip()
                if body:
                    entry_updates.append((clean_category(raw_cat), body))

        if not entry_updates:
            entry_updates.append(("Update", content_stripped))

        for idx, (cat, body) in enumerate(entry_updates):
            plain_body = html_to_plain(body, max_chars=180)
            tweet_text = f"BigQuery Release ({friendly_date}) - {cat}: {plain_body}"

            updates.append(
                {
                    "id":            f"{entry_id}_u{idx}",
                    "title":         title,
                    "friendly_date":  friendly_date,
                    "iso_date":      iso_date,
                    "link":          link,
                    "content_html":  body,
                    "categories":    [cat],
                    "tweet_text":    tweet_text,
                }
            )

    return updates


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/release-notes")
def release_notes():
    try:
        req = urllib.request.Request(
            FEED_URL,
            headers={"User-Agent": "BigQuery-ReleaseNotes-Viewer/1.0"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            xml_bytes = resp.read()

        entries = parse_feed(xml_bytes)
        return jsonify({"ok": True, "entries": entries, "count": len(entries)})

    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 502


if __name__ == "__main__":
    app.run(debug=True, port=5000)
