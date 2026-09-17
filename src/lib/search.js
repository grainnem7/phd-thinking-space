import { contentToText } from './noteText';
import { cleanTags } from './tags';

// Lightweight in-memory full-text search over notes, boards, tasks and papers.
// Matching is case- and diacritic-insensitive and requires every query word.

const DIACRITICS = /\p{Diacritic}/gu;

export function normalizeText(text) {
  return String(text ?? '').normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

// Normalised text plus, for each normalised character, the index of the
// original character it came from (so matches can be highlighted in the source).
function normalizeWithMap(text) {
  let norm = '';
  const map = [];
  for (let i = 0; i < text.length; i++) {
    // Keep surrogate pairs together
    const code = text.charCodeAt(i);
    const ch = code >= 0xd800 && code <= 0xdbff && i + 1 < text.length ? text.slice(i, i + 2) : text[i];
    const n = normalizeText(ch);
    for (let k = 0; k < n.length; k++) map.push(i);
    norm += n;
    if (ch.length === 2) i++;
  }
  map.push(text.length);
  return { norm, map };
}

export function queryWords(query) {
  return [...new Set(normalizeText(query).split(/\s+/).map((w) => w.replace(/^#/, '')).filter(Boolean))];
}

// Plain text is cached per id + stored content so re-indexing after one note
// changes doesn't re-parse every other note.
const textCache = new Map();
function cachedText(key, content) {
  const hit = textCache.get(key);
  if (hit && hit.content === content) return hit.text;
  const text = contentToText(content).replace(/\s+/g, ' ').trim();
  textCache.set(key, { content, text });
  return text;
}

function folderPath(section, byId) {
  const names = [];
  let parent = byId.get(section.parentId);
  let guard = 0;
  while (parent && guard++ < 50) {
    names.unshift(parent.name);
    parent = byId.get(parent.parentId);
  }
  return names.join(' / ');
}

function doc(fields) {
  const tags = cleanTags(fields.tags);
  return {
    ...fields,
    tags,
    titleNorm: normalizeText(fields.title),
    // Everything searchable besides the title
    restNorm: normalizeText([fields.body, fields.extra, tags.map((t) => `#${t}`).join(' ')].filter(Boolean).join(' \n ')),
  };
}

// kind: note | board | folder | task | paper
export function buildSearchIndex(sections = [], papers = []) {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const docs = [];

  for (const s of sections) {
    const path = folderPath(s, byId);
    if (s.type === 'board') {
      docs.push(doc({ key: s.id, kind: 'board', title: s.name || 'Untitled board', location: path, tags: s.tags, nav: { id: s.id } }));
      for (const task of s.tasks || []) {
        docs.push(doc({
          key: `${s.id}:${task.id}`,
          kind: 'task',
          title: task.title || 'Untitled task',
          body: task.description || '',
          location: s.name || 'Board',
          tags: task.tags,
          nav: { id: s.id, openTaskId: task.id },
        }));
      }
    } else if (s.type === 'folder') {
      docs.push(doc({ key: s.id, kind: 'folder', title: s.name || 'Untitled folder', location: path, nav: { id: s.id } }));
    } else {
      docs.push(doc({
        key: s.id,
        kind: 'note',
        title: s.name || 'Untitled',
        body: cachedText(s.id, s.content),
        location: path,
        tags: s.tags,
        nav: { id: s.id },
      }));
    }
  }

  for (const p of papers) {
    const tabNames = new Map((p.tabs || []).map((t) => [t.id, t.name]));
    const tabText = Object.entries(p.tabContent || {})
      .map(([tabId, content]) => {
        const text = cachedText(`paper:${p.id}:${tabId}`, content);
        return text ? `${tabNames.get(tabId) || 'Notes'}: ${text}` : '';
      })
      .filter(Boolean)
      .join(' · ');
    docs.push(doc({
      key: `paper:${p.id}`,
      kind: 'paper',
      title: p.title || 'Untitled paper',
      body: [p.summary, tabText].filter(Boolean).join(' · '),
      extra: [p.authors, p.year, p.journal].filter(Boolean).join(' '),
      subtitle: [p.authors, p.year].filter(Boolean).join(' · '),
      location: 'Reading list',
      tags: p.tags,
      nav: { id: 'reading-list', type: 'reading-list', name: 'Reading List', paperId: p.id },
    }));
  }

  return docs;
}

const KIND_BONUS = { note: 3, board: 2, folder: 2, paper: 1, task: 0 };

function score(d, words, phrase) {
  let inTitle = 0;
  for (const w of words) {
    if (d.titleNorm.includes(w)) inTitle++;
    else if (!d.restNorm.includes(w)) return 0;
  }
  let s = KIND_BONUS[d.kind] || 0;
  if (inTitle === words.length) {
    s += 100;
    if (d.titleNorm === phrase) s += 60;
    else if (d.titleNorm.startsWith(phrase)) s += 40;
    else if (d.titleNorm.includes(phrase)) s += 20;
  } else {
    s += 10 + (40 * inTitle) / words.length;
  }
  return s;
}

// Splits `text` into [{ text, match }] parts highlighting every query word
export function highlight(text, words) {
  if (!text) return [];
  const { norm, map } = normalizeWithMap(text);
  const ranges = [];
  for (const w of words) {
    let from = 0;
    let at;
    while (w && (at = norm.indexOf(w, from)) !== -1) {
      ranges.push([map[at], map[at + w.length - 1] + 1]);
      from = at + w.length;
    }
  }
  if (!ranges.length) return [{ text, match: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const parts = [];
  let pos = 0;
  for (const [start, end] of merged) {
    if (start > pos) parts.push({ text: text.slice(pos, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    pos = end;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), match: false });
  return parts;
}

// ~120 characters of `text` around the first match of any word
export function snippet(text, words, { before = 40, length = 130 } = {}) {
  if (!text) return '';
  const { norm, map } = normalizeWithMap(text);
  let first = -1;
  for (const w of words) {
    const at = norm.indexOf(w);
    if (at !== -1 && (first === -1 || at < first)) first = at;
  }
  if (first === -1) return text.length > length ? `${text.slice(0, length).replace(/\s+\S*$/, '')}…` : text;
  let start = Math.max(0, map[first] - before);
  if (start > 0) {
    const space = text.indexOf(' ', start);
    if (space !== -1 && space < map[first]) start = space + 1;
  }
  let end = Math.min(text.length, start + length);
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > map[first]) end = space;
  }
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

// Ranked results: [{ ...doc, score, snippet }]
export function search(index, query, { limit = 30 } = {}) {
  const words = queryWords(query);
  if (!words.length) return [];
  const phrase = words.join(' ');
  const hits = [];
  for (const d of index) {
    const s = score(d, words, phrase);
    if (s > 0) hits.push({ doc: d, score: s });
  }
  hits.sort((a, b) => b.score - a.score || a.doc.title.length - b.doc.title.length);
  return hits.slice(0, limit).map(({ doc: d, score: s }) => {
    const bodyHasMatch = words.some((w) => normalizeText(d.body).includes(w));
    return {
      ...d,
      score: s,
      words,
      snippet: bodyHasMatch ? snippet(d.body, words) : (d.subtitle || snippet(d.body, [])),
    };
  });
}
