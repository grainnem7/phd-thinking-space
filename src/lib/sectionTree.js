// Pure helpers for the notes/boards/folders tree (parentId + order).

// Items stay in Trash for this long before they are deleted for good
export const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// All ids in the subtree rooted at sectionId (inclusive)
export function subtreeIds(sections, sectionId) {
  const ids = [sectionId];
  const seen = new Set(ids);
  for (let i = 0; i < ids.length; i++) {
    for (const s of sections) {
      if (s.parentId === ids[i] && !seen.has(s.id)) {
        seen.add(s.id);
        ids.push(s.id);
      }
    }
  }
  return ids;
}

// Folders, plus older untyped items that already hold children
export function isFolderSection(section, sections) {
  if (!section) return false;
  if (section.type === 'folder') return true;
  return !section.type && sections.some((s) => s.parentId === section.id);
}

// Whether `sectionId` may be moved into `newParentId` (null = top level)
export function canMoveSection(sections, sectionId, newParentId) {
  const item = sections.find((s) => s.id === sectionId);
  if (!item) return false;
  if (newParentId == null) return true;
  if (newParentId === sectionId) return false;
  const parent = sections.find((s) => s.id === newParentId);
  if (!isFolderSection(parent, sections)) return false;
  return !subtreeIds(sections, sectionId).includes(newParentId);
}

// Siblings under parentId sorted by order
export function childrenOf(sections, parentId) {
  return sections
    .filter((s) => (s.parentId ?? null) === (parentId ?? null))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// "Research Notes / Chapter 2" for the folder that holds an item
export function locationLabel(sections, parentId) {
  const names = [];
  const seen = new Set();
  let current = sections.find((s) => s.id === parentId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name || 'Untitled');
    current = sections.find((s) => s.id === current.parentId);
  }
  return names.length ? names.join(' / ') : 'Top level';
}

function toMillis(value) {
  if (!value) return NaN;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value).getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  return NaN;
}

// Whole days left before a trashed item is purged (never negative)
export function trashDaysLeft(deletedAt, now = Date.now()) {
  const deleted = toMillis(deletedAt);
  if (Number.isNaN(deleted)) return TRASH_RETENTION_DAYS;
  const left = Math.ceil((deleted + TRASH_RETENTION_DAYS * DAY_MS - now) / DAY_MS);
  return Math.max(0, left);
}

export function isTrashExpired(deletedAt, now = Date.now()) {
  const deleted = toMillis(deletedAt);
  return !Number.isNaN(deleted) && now - deleted >= TRASH_RETENTION_DAYS * DAY_MS;
}
