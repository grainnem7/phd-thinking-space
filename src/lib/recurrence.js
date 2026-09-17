// Pure date maths for repeating calendar events.
//
// An event repeats when it carries
//   recurrence: { freq: 'daily'|'weekly'|'monthly'|'yearly', interval,
//                 byWeekday?: number[] (0=Mon..6=Sun), monthlyMode?: 'dayOfMonth'|'nthWeekday',
//                 until?: 'YYYY-MM-DD', count?: number }
//   exdates: string[]  (occurrence dates that were skipped or replaced by an override)
// The event's own `date` is the anchor: monthly/yearly rules take the day of month,
// weekday and month from it, and weekly `interval` counts weeks (Mon-first) from it.
// As in RFC 5545, `count` counts occurrences before exdates are removed.
//
// Dates are 'YYYY-MM-DD' keys in local time throughout; nothing here depends on
// the time zone or the current date.

const DAY_MS = 86400000;
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ORDINALS = ['first', 'second', 'third', 'fourth', 'last'];
const SAFETY_PERIODS = 20000;

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m: m - 1, d };
}

function makeKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Whole-day arithmetic via UTC so DST changes never shift a day.
function dayNumber(key) {
  const { y, m, d } = parseKey(key);
  return Math.round(Date.UTC(y, m, d) / DAY_MS);
}

function keyFromDayNumber(n) {
  const date = new Date(n * DAY_MS);
  return makeKey(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function addDaysToKey(key, days) {
  return keyFromDayNumber(dayNumber(key) + days);
}

export function daysBetween(fromKey, toKey) {
  return dayNumber(toKey) - dayNumber(fromKey);
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

// 0 = Monday … 6 = Sunday
export function weekdayOf(key) {
  const { y, m, d } = parseKey(key);
  return (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7;
}

// Which weekday-of-month a date is: n = 1..4, or 5 meaning "last" for a 5th occurrence.
export function nthWeekdayOf(key) {
  const { d } = parseKey(key);
  return { n: Math.min(Math.ceil(d / 7), 5), weekday: weekdayOf(key) };
}

// The date of the nth (1..4, 5 = last) given weekday in a month
function nthWeekdayInMonth(y, m, n, weekday) {
  const firstWeekday = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  if (n >= 5) {
    const last = daysInMonth(y, m);
    const lastWeekday = (firstWeekday + last - 1) % 7;
    return last - ((lastWeekday - weekday + 7) % 7);
  }
  return 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
}

// Removes empty/undefined fields (Firestore rejects undefined) and fills defaults.
export function normalizeRecurrence(recurrence, startKey) {
  if (!recurrence?.freq) return null;
  const out = { freq: recurrence.freq, interval: Math.max(1, Math.floor(Number(recurrence.interval) || 1)) };
  if (out.freq === 'weekly') {
    const days = [...new Set((recurrence.byWeekday || []).map(Number).filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b);
    out.byWeekday = days.length ? days : startKey ? [weekdayOf(startKey)] : [0];
  }
  if (out.freq === 'monthly') out.monthlyMode = recurrence.monthlyMode === 'nthWeekday' ? 'nthWeekday' : 'dayOfMonth';
  if (recurrence.until) out.until = recurrence.until;
  else if (Number(recurrence.count) > 0) out.count = Math.floor(Number(recurrence.count));
  return out;
}

export function sameRecurrence(a, b, startKey) {
  return JSON.stringify(normalizeRecurrence(a, startKey)) === JSON.stringify(normalizeRecurrence(b, startKey));
}

// Occurrence dates falling in period p (sorted, possibly empty), and the first day of that period.
function period(startKey, rule, p) {
  const { y, m, d } = parseKey(startKey);
  const step = p * rule.interval;
  switch (rule.freq) {
    case 'daily': {
      const key = addDaysToKey(startKey, step);
      return { periodStart: key, dates: [key] };
    }
    case 'weekly': {
      const weekStart = addDaysToKey(startKey, -weekdayOf(startKey) + step * 7);
      const dates = rule.byWeekday.map((wd) => addDaysToKey(weekStart, wd)).filter((k) => k >= startKey);
      return { periodStart: weekStart, dates };
    }
    case 'monthly': {
      const total = m + step;
      const yy = y + Math.floor(total / 12);
      const mm = ((total % 12) + 12) % 12;
      const periodStart = makeKey(yy, mm, 1);
      if (rule.monthlyMode === 'nthWeekday') {
        const { n, weekday } = nthWeekdayOf(startKey);
        return { periodStart, dates: [makeKey(yy, mm, nthWeekdayInMonth(yy, mm, n, weekday))] };
      }
      return { periodStart, dates: d <= daysInMonth(yy, mm) ? [makeKey(yy, mm, d)] : [] };
    }
    case 'yearly': {
      const yy = y + step;
      return { periodStart: makeKey(yy, 0, 1), dates: d <= daysInMonth(yy, m) ? [makeKey(yy, m, d)] : [] };
    }
    default:
      return { periodStart: startKey, dates: [] };
  }
}

// A period index at or just before the one containing `key` (only used without `count`).
function periodNear(startKey, rule, key) {
  if (key <= startKey) return 0;
  const s = parseKey(startKey);
  const k = parseKey(key);
  let units;
  switch (rule.freq) {
    case 'daily': units = daysBetween(startKey, key); break;
    case 'weekly': units = Math.floor(daysBetween(addDaysToKey(startKey, -weekdayOf(startKey)), key) / 7); break;
    case 'monthly': units = (k.y - s.y) * 12 + (k.m - s.m); break;
    case 'yearly': units = k.y - s.y; break;
    default: units = 0;
  }
  return Math.max(0, Math.floor(units / rule.interval) - 1);
}

// Calls visit(dateKey) for every occurrence from the series start (ignoring exdates) up to
// `toKey`, in order. Stops early when visit returns false.
function walk(event, toKey, fromKey, visit) {
  const startKey = event.date;
  const rule = normalizeRecurrence(event.recurrence, startKey);
  if (!rule) {
    if (startKey <= toKey) visit(startKey);
    return;
  }
  const limit = rule.until && rule.until < toKey ? rule.until : toKey;
  let produced = 0;
  const first = rule.count || !fromKey ? 0 : periodNear(startKey, rule, fromKey);
  for (let p = first; p < first + SAFETY_PERIODS; p++) {
    const { periodStart, dates } = period(startKey, rule, p);
    if (periodStart > limit) return;
    for (const key of dates) {
      if (key > limit) return;
      if (rule.count && produced >= rule.count) return;
      produced++;
      if (visit(key) === false) return;
    }
  }
}

// Occurrence dates of an event within [startKey, endKey], exdates removed.
// Works for non-repeating events too (returns [event.date] when in range).
export function expandOccurrences(event, startKey, endKey) {
  if (!event?.date || startKey > endKey) return [];
  const skip = new Set(event.exdates || []);
  const out = [];
  walk(event, endKey, startKey, (key) => {
    if (key >= startKey && !skip.has(key)) out.push(key);
  });
  return out;
}

export function isOccurrence(event, key) {
  return expandOccurrences(event, key, key).length === 1;
}

// How many occurrences (counting exdated ones, as `count` does) fall before `key`.
export function countOccurrencesBefore(event, key) {
  let n = 0;
  walk(event, addDaysToKey(key, -1), null, () => { n++; });
  return n;
}

export function firstOccurrence(event) {
  let first = null;
  walk(event, '9999-12-31', null, (key) => { first = key; return false; });
  return first;
}

// Recurrence for a series moved by `delta` days: weekly weekdays rotate with it and an
// end date moves too, so the series keeps its shape and length.
export function shiftRecurrence(recurrence, delta, startKey) {
  const rule = normalizeRecurrence(recurrence, startKey);
  if (!rule || !delta) return rule;
  if (rule.byWeekday) rule.byWeekday = [...new Set(rule.byWeekday.map((d) => (((d + delta) % 7) + 7) % 7))].sort((a, b) => a - b);
  if (rule.until) rule.until = addDaysToKey(rule.until, delta);
  return rule;
}

// Splits a series at `key` (an occurrence after the first one).
// Returns the rule that ends the original series the day before, and the rule for a new
// series starting at `key` that keeps any remaining `count`.
export function splitRecurrence(event, key) {
  const rule = normalizeRecurrence(event.recurrence, event.date);
  if (!rule) return { before: null, after: null };
  const { count: _count, until: _until, ...base } = rule;
  const before = { ...base, until: addDaysToKey(key, -1) };
  const after = { ...base };
  if (rule.until) after.until = rule.until;
  if (rule.count) after.count = Math.max(1, rule.count - countOccurrencesBefore(event, key));
  return { before, after };
}

function formatShort(key, withYear) {
  const { y, m, d } = parseKey(key);
  return `${d} ${MONTH_SHORT[m]}${withYear ? ` ${y}` : ''}`;
}

function joinList(parts) {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// "Every week on Tue and Thu until 12 Dec", "Every month on the second Tuesday, 6 times"
export function describeRecurrence(recurrence, startKey, { todayKey } = {}) {
  const rule = normalizeRecurrence(recurrence, startKey);
  if (!rule) return 'Does not repeat';
  const n = rule.interval;
  let text;
  switch (rule.freq) {
    case 'daily':
      text = n === 1 ? 'Every day' : `Every ${n} days`;
      break;
    case 'weekly': {
      const days = rule.byWeekday;
      if (n === 1 && days.join() === '0,1,2,3,4') text = 'Every weekday';
      else if (days.length === 7) text = n === 1 ? 'Every day' : `Every ${n} weeks, every day`;
      else text = `${n === 1 ? 'Every week' : `Every ${n} weeks`} on ${joinList(days.map((d) => WEEKDAY_SHORT[d]))}`;
      break;
    }
    case 'monthly': {
      const every = n === 1 ? 'Every month' : `Every ${n} months`;
      if (rule.monthlyMode === 'nthWeekday' && startKey) {
        const { n: nth, weekday } = nthWeekdayOf(startKey);
        text = `${every} on the ${ORDINALS[nth - 1]} ${WEEKDAY_LONG[weekday]}`;
      } else {
        text = `${every} on day ${startKey ? parseKey(startKey).d : '?'}`;
      }
      break;
    }
    case 'yearly':
      text = `${n === 1 ? 'Every year' : `Every ${n} years`}${startKey ? ` on ${formatShort(startKey, false)}` : ''}`;
      break;
    default:
      text = 'Repeats';
  }
  if (rule.until) {
    const refYear = (todayKey || startKey || rule.until).slice(0, 4);
    text += ` until ${formatShort(rule.until, rule.until.slice(0, 4) !== refYear)}`;
  } else if (rule.count) {
    text += rule.count === 1 ? ', once' : `, ${rule.count} times`;
  }
  return text;
}
