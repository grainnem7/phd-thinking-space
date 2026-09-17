import { differenceInCalendarDays } from 'date-fns';

// Parses a date-only "YYYY-MM-DD" string as local time, avoiding the
// UTC-midnight pitfall of parseISO/new Date(str) that causes off-by-one bugs.
export function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysUntil(dateStr) {
  const target = parseLocalDate(dateStr);
  if (!target) return 0;
  return differenceInCalendarDays(target, new Date());
}

// Formats a Date as a local "YYYY-MM-DD" key (the inverse of parseLocalDate).
export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "HH:mm" -> minutes since midnight (null if malformed)
export function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
