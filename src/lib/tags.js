// Tags are lower-case strings stored as `tags: string[]` on notes, boards,
// papers and board tasks, and shown as `#tag` chips.

export const MAX_TAG_LENGTH = 40;

// "  #Machine Learning " -> "machine-learning"
export function normalizeTag(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[,\s]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_TAG_LENGTH);
}

// Normalised, de-duplicated copy of a stored tag list (older tasks may hold
// mixed-case tags)
export function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (const t of tags) {
    const tag = normalizeTag(t);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}

export const hasTag = (tags, tag) => cleanTags(tags).includes(tag);

// Renames `from` to `to` in a list (merging if `to` is already present).
// Returns null when the list doesn't contain `from`.
export function renameInList(tags, from, to) {
  const clean = cleanTags(tags);
  if (!clean.includes(from)) return null;
  return cleanTags(clean.map((t) => (t === from ? to : t)));
}

export function removeFromList(tags, tag) {
  const clean = cleanTags(tags);
  if (!clean.includes(tag)) return null;
  return clean.filter((t) => t !== tag);
}

// Every taggable thing in the workspace, flattened:
// { kind: 'note' | 'board' | 'task' | 'paper', id, title, tags, location, nav }
export function collectTaggables(sections = [], papers = []) {
  const items = [];
  for (const s of sections) {
    if (s.type === 'note' || s.type === 'board') {
      const tags = cleanTags(s.tags);
      if (tags.length) {
        items.push({ kind: s.type, id: s.id, title: s.name || 'Untitled', tags, nav: { id: s.id } });
      }
    }
    if (s.type === 'board' && Array.isArray(s.tasks)) {
      for (const task of s.tasks) {
        const tags = cleanTags(task.tags);
        if (tags.length) {
          items.push({
            kind: 'task',
            id: `${s.id}:${task.id}`,
            title: task.title || 'Untitled task',
            location: s.name,
            tags,
            nav: { id: s.id, openTaskId: task.id },
          });
        }
      }
    }
  }
  for (const p of papers) {
    const tags = cleanTags(p.tags);
    if (tags.length) {
      items.push({
        kind: 'paper',
        id: p.id,
        title: p.title || 'Untitled',
        location: [p.authors, p.year].filter(Boolean).join(' · '),
        tags,
        nav: { id: 'reading-list', type: 'reading-list', name: 'Reading List', paperId: p.id },
      });
    }
  }
  return items;
}

// [{ tag, count }] sorted by count, then name
export function countTags(taggables) {
  const counts = new Map();
  for (const item of taggables) {
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// Clicking a tag chip anywhere opens the Tags view filtered to it. Components
// deep in the tree (task cards, paper details) don't receive a navigation
// callback, so the request travels as a window event.
export const OPEN_TAG_EVENT = 'thinking-space:open-tag';

export function openTagView(tag) {
  window.dispatchEvent(new CustomEvent(OPEN_TAG_EVENT, { detail: { tag: normalizeTag(tag) } }));
}
