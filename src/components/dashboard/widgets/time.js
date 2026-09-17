import { formatDistanceToNow } from 'date-fns';

// Firestore Timestamp, ISO string or epoch -> Date (null if missing/invalid)
export function parseDate(value) {
  if (!value) return null;
  try {
    const d = value.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function timeAgo(value) {
  const d = parseDate(value);
  if (!d) return '';
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
}
