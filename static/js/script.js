/* ─────────────────────────────────────────────────────────────────────────
   BigQuery Release Notes – script.js
   ───────────────────────────────────────────────────────────────────────── */

'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────
const refreshBtn    = document.getElementById('refresh-btn');
const skeletonList  = document.getElementById('skeleton-list');
const cardsList     = document.getElementById('cards-list');
const errorState    = document.getElementById('error-state');
const errorMessage  = document.getElementById('error-message');
const emptyState    = document.getElementById('empty-state');
const lastUpdated   = document.getElementById('last-updated');
const searchInput   = document.getElementById('search-input');
const filterTagsEl  = document.getElementById('filter-tags');
const entryCount    = document.getElementById('entry-count');

// Modal refs
const tweetModal    = document.getElementById('tweet-modal');
const modalClose    = document.getElementById('modal-close');
const modalCancel   = document.getElementById('modal-cancel');
const modalDate     = document.getElementById('modal-entry-date');
const tweetTextarea = document.getElementById('tweet-text');
const charCount     = document.getElementById('char-count');
const tweetBtn      = document.getElementById('tweet-btn');

// ── State ─────────────────────────────────────────────────────────────────
let allEntries      = [];   // raw entries from API
let activeCategory  = null; // filter tag currently selected
let currentLink     = '';   // link attached to open modal

// ── Category → badge CSS class mapping ───────────────────────────────────
const BADGE_CLASS = {
  'Feature':        'badge-Feature',
  'Issue':          'badge-Issue',
  'Fix':            'badge-Fix',
  'Announcement':   'badge-Announcement',
  'Preview':        'badge-Preview',
  'Deprecation':    'badge-Deprecation',
  'Breaking Change':'badge-Breaking Change',
  'Changed':        'badge-Changed',
  'Update':         'badge-Update',
};

// ── Helpers ───────────────────────────────────────────────────────────────

/** Escape text to avoid XSS when inserting into attributes */
function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Strip HTML tags for plain text */
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

/** Build a Twitter/X Web Intent URL */
function buildTweetUrl(text) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

/** Format timestamp for "last updated" display */
function formatNow() {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date());
}

// ── Loading / UI state helpers ────────────────────────────────────────────

function showSkeleton() {
  skeletonList.classList.remove('hidden');
  cardsList.classList.add('hidden');
  errorState.classList.add('hidden');
  emptyState.classList.add('hidden');
}

function showCards() {
  skeletonList.classList.add('hidden');
  cardsList.classList.remove('hidden');
  errorState.classList.add('hidden');
  emptyState.classList.add('hidden');
}

function showError(msg) {
  skeletonList.classList.add('hidden');
  cardsList.classList.add('hidden');
  emptyState.classList.add('hidden');
  errorState.classList.remove('hidden');
  errorMessage.textContent = msg;
}

function showEmpty() {
  emptyState.classList.remove('hidden');
  cardsList.classList.add('hidden');
}

function setRefreshing(loading) {
  refreshBtn.disabled = loading;
  refreshBtn.classList.toggle('spinning', loading);
}

// ── Build card HTML ───────────────────────────────────────────────────────

function buildCardHTML(entry, index) {
  // Category badges
  const badgesHTML = entry.categories
    .map(cat => {
      const cls = BADGE_CLASS[cat] || 'badge-Update';
      return `<span class="badge ${cls}">${escAttr(cat)}</span>`;
    })
    .join('');

  // Stagger animation delay capped at index 12
  const delay = Math.min(index * 0.04, 0.48);

  return `
    <article class="note-card" style="animation-delay:${delay}s"
             aria-label="Release notes for ${escAttr(entry.friendly_date)}">
      <div class="card-header">
        <div class="card-meta">
          <div class="card-date">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8"  y1="2" x2="8"  y2="6"/>
              <line x1="3"  y1="10" x2="21" y2="10"/>
            </svg>
            ${escAttr(entry.friendly_date)}
          </div>
          <div class="badge-row">${badgesHTML}</div>
        </div>
      </div>

      <div class="card-body">${entry.content_html}</div>

      <div class="card-footer">
        <a class="btn-docs" href="${escAttr(entry.link)}" target="_blank" rel="noopener noreferrer"
           aria-label="Read full notes for ${escAttr(entry.friendly_date)} on Google Cloud docs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          View on Google Cloud Docs
        </a>
        <div class="card-actions">
          <button class="btn-copy-card"
                  data-text="${escAttr(entry.tweet_text)}"
                  aria-label="Copy update text to clipboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span class="copy-label">Copy</span>
          </button>
          <button class="btn-tweet-card"
                  data-date="${escAttr(entry.friendly_date)}"
                  data-text="${escAttr(entry.tweet_text)}"
                  data-link="${escAttr(entry.link)}"
                  aria-label="Tweet about ${escAttr(entry.friendly_date)} release notes">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L2.012 2.25h6.956l4.255 5.626L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
            </svg>
            Tweet this
          </button>
        </div>
      </div>
    </article>
  `;
}

// ── Render visible cards (after search/filter) ────────────────────────────

function renderCards(entries) {
  if (entries.length === 0) {
    showEmpty();
    entryCount.textContent = '0 results';
    return;
  }

  cardsList.innerHTML = entries.map((e, i) => buildCardHTML(e, i)).join('');
  showCards();

  entryCount.textContent =
    `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;

  // Attach tweet button listeners
  cardsList.querySelectorAll('.btn-tweet-card').forEach(btn => {
    btn.addEventListener('click', () => {
      openTweetModal(
        btn.dataset.date,
        btn.dataset.text,
        btn.dataset.link,
      );
    });
  });

  // Attach copy button listeners
  cardsList.querySelectorAll('.btn-copy-card').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.text;
      const label = btn.querySelector('.copy-label');
      try {
        await navigator.clipboard.writeText(text);
        const originalText = label.textContent;
        label.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          label.textContent = originalText;
          btn.classList.remove('copied');
        }, 1500);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    });
  });
}

// ── Filter + search logic ─────────────────────────────────────────────────

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();

  let filtered = allEntries;

  if (activeCategory) {
    filtered = filtered.filter(e => e.categories.includes(activeCategory));
  }

  if (query) {
    filtered = filtered.filter(e => {
      const plain = stripHtml(e.content_html).toLowerCase();
      return plain.includes(query) || e.friendly_date.toLowerCase().includes(query);
    });
  }

  renderCards(filtered);
}

// ── Build filter tag buttons from all unique categories ───────────────────

function buildFilterTags(entries) {
  const seen = new Set();
  const order = [
    'Feature','Announcement','Preview','Fix','Issue',
    'Deprecation','Breaking Change','Changed','Update'
  ];

  entries.forEach(e => e.categories.forEach(c => seen.add(c)));

  // Sort by preferred order, append unknowns
  const cats = order.filter(c => seen.has(c));
  seen.forEach(c => { if (!cats.includes(c)) cats.push(c); });

  filterTagsEl.innerHTML = '';

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-tag';
    btn.textContent = cat;
    btn.setAttribute('aria-pressed', 'false');

    btn.addEventListener('click', () => {
      if (activeCategory === cat) {
        activeCategory = null;
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      } else {
        // Deactivate previous
        filterTagsEl.querySelectorAll('.filter-tag').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        activeCategory = cat;
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      }
      applyFilters();
    });

    filterTagsEl.appendChild(btn);
  });
}

// ── Fetch release notes from Flask backend ────────────────────────────────

async function loadNotes() {
  setRefreshing(true);
  showSkeleton();

  try {
    const res = await fetch('/api/release-notes');

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(body.error || `Server returned ${res.status}`);
    }

    const data = await res.json();

    if (!data.ok) throw new Error(data.error || 'Unknown error');

    allEntries     = data.entries;
    activeCategory = null;

    // Reset search + filters
    searchInput.value = '';
    filterTagsEl.querySelectorAll('.filter-tag').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });

    buildFilterTags(allEntries);
    renderCards(allEntries);

    lastUpdated.textContent = `Updated at ${formatNow()}`;

  } catch (err) {
    showError(err.message);
  } finally {
    setRefreshing(false);
  }
}

// ── Tweet modal ───────────────────────────────────────────────────────────

function openTweetModal(date, text, link) {
  currentLink = link;

  // Build tweet copy: text + link (Twitter auto-shortens links to ~23 chars)
  const LINK_RESERVED = 24; // t.co-shortened link budget
  const MAX           = 280 - LINK_RESERVED - 2; // 2 = space + newline
  const truncated     = text.length > MAX ? text.slice(0, MAX - 1) + '…' : text;

  tweetTextarea.value = `${truncated}\n\n${link}`;
  updateCharCount();

  modalDate.textContent = date;
  tweetModal.classList.remove('hidden');
  tweetTextarea.focus();
}

function closeTweetModal() {
  tweetModal.classList.add('hidden');
  tweetTextarea.value = '';
  currentLink = '';
}

function updateCharCount() {
  const len = tweetTextarea.value.length;
  charCount.textContent = `${len} / 280`;
  charCount.classList.toggle('over', len > 280);
  tweetBtn.disabled = len === 0 || len > 280;
}

// ── Event listeners ───────────────────────────────────────────────────────

refreshBtn.addEventListener('click', loadNotes);

searchInput.addEventListener('input', applyFilters);

tweetTextarea.addEventListener('input', updateCharCount);

modalClose.addEventListener('click', closeTweetModal);
modalCancel.addEventListener('click', closeTweetModal);

// Close modal on overlay click
tweetModal.addEventListener('click', e => {
  if (e.target === tweetModal) closeTweetModal();
});

// Close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !tweetModal.classList.contains('hidden')) {
    closeTweetModal();
  }
});

// Open Twitter/X Web Intent in a small popup window
tweetBtn.addEventListener('click', () => {
  const text = tweetTextarea.value.trim();
  if (!text) return;

  const url = buildTweetUrl(text);
  window.open(url, 'tweet-window', 'width=600,height=450,resizable=yes,scrollbars=yes');
  closeTweetModal();
});

// ── Export to CSV feature ──────────────────────────────────────────────────
const exportCsvBtn = document.getElementById('export-csv-btn');

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function exportToCSV() {
  const query = searchInput.value.trim().toLowerCase();
  let filtered = allEntries;
  
  if (activeCategory) {
    filtered = filtered.filter(e => e.categories.includes(activeCategory));
  }
  
  if (query) {
    filtered = filtered.filter(e => {
      const plain = stripHtml(e.content_html).toLowerCase();
      return plain.includes(query) || e.friendly_date.toLowerCase().includes(query);
    });
  }

  if (filtered.length === 0) return;

  const headers = ['Date', 'Category', 'Update Text (Plain)', 'Link'];
  const rows = filtered.map(e => [
    e.friendly_date,
    e.category || (e.categories && e.categories[0]) || 'Update',
    stripHtml(e.content_html),
    e.link
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `bigquery_release_notes_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

exportCsvBtn.addEventListener('click', exportToCSV);

// ── Bootstrap ─────────────────────────────────────────────────────────────
loadNotes();
