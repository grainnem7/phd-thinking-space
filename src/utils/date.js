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
