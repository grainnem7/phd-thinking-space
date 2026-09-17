import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { timeToMinutes, toDateKey } from '../../utils/date';
import { isDoneColumn } from '../../hooks/useBoards';
import { expandOccurrences, addDaysToKey } from '../../lib/recurrence';
import { colorVars } from './categoryColors';

// Window used to expand repeating events when a caller doesn't pass a range.
export function defaultEntriesRange(now = new Date()) {
  const today = toDateKey(now);
  return { start: addDaysToKey(today, -60), end: addDaysToKey(today, 400) };
}

// Range the dashboard needs data for: this month's grid plus the next 7 days.
export function dashboardCalendarRange(now = new Date()) {
  const gridStart = startOfWeek(startOfMonth(now), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(now), { weekStartsOn: 1 });
  const weekEnd = addDays(now, 6);
  return {
    start: toDateKey(gridStart),
    end: toDateKey(weekEnd > gridEnd ? weekEnd : gridEnd),
  };
}

export const DEADLINE_STYLE = { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200', bar: 'border-l-amber-500' };
export const TASK_STYLE = { dot: 'bg-neutral-400', chip: 'bg-white text-neutral-700 ring-1 ring-inset ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-700', bar: 'border-l-neutral-300' };
export const GOOGLE_STYLE = { dot: '', chip: 'bg-neutral-50 text-neutral-700 dark:bg-neutral-800/70 dark:text-neutral-200', bar: 'border-l-transparent' };

// Events use theme-aware category colours: apply `vars` as inline style
// alongside the class names (see .cat-* in index.css).
export function styleFor(entry) {
  if (entry.source === 'deadline') return DEADLINE_STYLE;
  if (entry.source === 'task') return TASK_STYLE;
  if (entry.source === 'google') return GOOGLE_STYLE;
  return { chip: 'cat-chip', dot: 'cat-dot', bar: 'cat-bar', vars: colorVars(entry.category?.color || entry.color) };
}

// Merge every dated thing in the app into one list of calendar entries.
// Repeating events become one entry per occurrence within `range` ({ start, end }
// date keys; defaults to 60 days back to 400 days ahead). Occurrence entries have
// ids like `${seriesId}__${date}` plus `seriesId` and `occurrenceDate`.
export function buildEntries({ items = [], deadlines = [], sections = [], googleEvents = [], categories = [], range } = {}) {
  const entries = [];
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const { start, end } = range?.start && range?.end ? range : defaultEntriesRange();

  for (const item of items) {
    if (item.kind !== 'event' || !item.date) continue;
    const allDay = Boolean(item.allDay || !item.startTime);
    const category = item.categoryId ? categoryById.get(item.categoryId) || null : null;
    if (!item.recurrence?.freq) {
      entries.push({ ...item, source: 'event', allDay, category });
      continue;
    }
    for (const date of expandOccurrences(item, start, end)) {
      entries.push({ ...item, id: `${item.id}__${date}`, date, seriesId: item.id, occurrenceDate: date, source: 'event', allDay, category });
    }
  }

  for (const d of deadlines) {
    if (!d?.date) continue;
    entries.push({ id: `deadline-${d.id}`, deadlineId: d.id, source: 'deadline', title: d.title, date: d.date, allDay: true });
  }

  for (const board of sections) {
    if (board.type !== 'board') continue;
    const columns = board.columns || [];
    for (const task of board.tasks || []) {
      if (!task.dueDate) continue;
      entries.push({
        id: `task-${board.id}-${task.id}`,
        source: 'task',
        title: task.title,
        date: task.dueDate,
        allDay: true,
        boardId: board.id,
        boardName: board.name,
        taskId: task.id,
        done: isDoneColumn(columns.find((c) => c.id === task.columnId)),
      });
    }
  }

  entries.push(...googleEvents);
  return entries;
}

const SOURCE_ORDER = { deadline: 0, event: 1, google: 2, task: 3 };

export function compareEntries(a, b) {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (!a.allDay) {
    const diff = (timeToMinutes(a.startTime) ?? 0) - (timeToMinutes(b.startTime) ?? 0);
    if (diff !== 0) return diff;
  }
  const s = (SOURCE_ORDER[a.source] ?? 9) - (SOURCE_ORDER[b.source] ?? 9);
  if (s !== 0) return s;
  return (a.title || '').localeCompare(b.title || '');
}

// Map of 'YYYY-MM-DD' -> sorted entries
export function groupByDate(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  }
  for (const list of map.values()) list.sort(compareEntries);
  return map;
}

export function todosByDate(items = []) {
  const map = new Map();
  for (const item of items) {
    if (item.kind !== 'todo' || !item.date) continue;
    if (!map.has(item.date)) map.set(item.date, []);
    map.get(item.date).push(item);
  }
  for (const list of map.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return map;
}
