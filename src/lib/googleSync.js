// Two-way Google Calendar sync (pure logic + REST calls; no React).
//
// For every connected Google account with sync on, the app keeps a calendar
// called "Thinking Space" that contains:
//   - app calendar events (key "e:<itemId>") and deadlines ("d:<deadlineId>")
//   - copies of events from the user's OTHER connected Google accounts
//     ("m:<email>|<calendarId>|<eventId>"), so each account sees the others
//
// Every event we write carries extendedProperties.private { tsKey, tsHash },
// where tsHash is a hash of the content as last written. Comparing the hash
// with the current app content and the current Google content tells us which
// side changed:
//   app changed only    → update Google
//   Google changed only → update the app (events/deadlines only; copies are read-only)
//   both changed        → the most recently updated side wins
//   deleted in Google   → delete in the app (event status "cancelled")
//   deleted in the app  → delete in Google

import { addDaysToKey, nthWeekdayOf, normalizeRecurrence } from './recurrence';
import { toDateKey } from '../utils/date';

const API = 'https://www.googleapis.com/calendar/v3';
export const SYNC_CALENDAR_NAME = 'Thinking Space';
export const SYNC_CALENDAR_MARKER = '[thinking-space-sync]';
const DEADLINE_PREFIX = 'Deadline: ';
const MIRROR_WINDOW = { back: 14, ahead: 180 };
const MAX_MIRRORED_PER_ACCOUNT = 600;

const DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export function isSyncCalendar(calendar) {
  return typeof calendar?.description === 'string' && calendar.description.includes(SYNC_CALENDAR_MARKER);
}

function localTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

function hash(value) {
  const text = JSON.stringify(value);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function hhmm(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const compactDate = (key) => key.replaceAll('-', '');
const expandDate = (compact) => `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;

// ---------------------------------------------------------------------------
// Recurrence ⇄ RRULE (the subset the app supports)
// ---------------------------------------------------------------------------

export function toRecurrenceLines(item, tz = localTimeZone()) {
  const rule = normalizeRecurrence(item.recurrence, item.date);
  if (!rule) return [];
  const parts = [`FREQ=${rule.freq.toUpperCase()}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === 'weekly') parts.push(`BYDAY=${rule.byWeekday.map((d) => DAYS[d]).join(',')}`);
  if (rule.freq === 'monthly') {
    if (rule.monthlyMode === 'nthWeekday') {
      const { n, weekday } = nthWeekdayOf(item.date);
      parts.push(`BYDAY=${n === 5 ? -1 : n}${DAYS[weekday]}`);
    } else {
      parts.push(`BYMONTHDAY=${Number(item.date.slice(8, 10))}`);
    }
  }
  if (rule.until) parts.push(item.allDay ? `UNTIL=${compactDate(rule.until)}` : `UNTIL=${compactDate(rule.until)}T235959Z`);
  else if (rule.count) parts.push(`COUNT=${rule.count}`);

  const lines = [`RRULE:${parts.join(';')}`];
  const exdates = [...new Set(item.exdates || [])].sort();
  if (exdates.length) {
    lines.push(item.allDay
      ? `EXDATE;VALUE=DATE:${exdates.map(compactDate).join(',')}`
      : `EXDATE;TZID=${tz}:${exdates.map((d) => `${compactDate(d)}T${(item.startTime || '00:00').replace(':', '')}00`).join(',')}`);
  }
  return lines;
}

export function fromRecurrenceLines(lines = []) {
  const rruleLine = lines.find((l) => l.startsWith('RRULE:'));
  const exdates = lines
    .filter((l) => l.startsWith('EXDATE'))
    .flatMap((l) => l.slice(l.indexOf(':') + 1).split(','))
    .map((v) => expandDate(v.trim()))
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));
  if (!rruleLine) return { recurrence: null, exdates };

  const fields = Object.fromEntries(rruleLine.slice(6).split(';').map((p) => p.split('=')));
  const freq = (fields.FREQ || '').toLowerCase();
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(freq)) return { recurrence: null, exdates };
  const recurrence = { freq, interval: Math.max(1, Number(fields.INTERVAL) || 1) };
  if (freq === 'weekly' && fields.BYDAY) {
    recurrence.byWeekday = fields.BYDAY.split(',').map((d) => DAYS.indexOf(d.slice(-2))).filter((d) => d >= 0);
  }
  if (freq === 'monthly') recurrence.monthlyMode = fields.BYDAY ? 'nthWeekday' : 'dayOfMonth';
  if (fields.UNTIL) recurrence.until = expandDate(fields.UNTIL.slice(0, 8));
  else if (fields.COUNT) recurrence.count = Number(fields.COUNT);
  return { recurrence, exdates };
}

// ---------------------------------------------------------------------------
// Normalised content (what we compare and hash)
// ---------------------------------------------------------------------------

function appEventContent(item) {
  const allDay = Boolean(item.allDay || !item.startTime);
  return {
    title: item.title || '',
    notes: item.notes || '',
    date: item.date,
    allDay,
    startTime: allDay ? null : item.startTime,
    endTime: allDay ? null : (item.endTime || item.startTime),
    recurrence: toRecurrenceLines({ ...item, allDay }),
  };
}

function deadlineContent(deadline) {
  return { title: `${DEADLINE_PREFIX}${deadline.title || ''}`, notes: '', date: deadline.date, allDay: true, startTime: null, endTime: null, recurrence: [] };
}

function googleContent(event, tz) {
  const allDay = Boolean(event.start?.date);
  let date;
  let startTime = null;
  let endTime = null;
  if (allDay) {
    date = event.start.date;
  } else {
    const start = new Date(event.start.dateTime);
    const end = event.end?.dateTime ? new Date(event.end.dateTime) : start;
    date = toDateKey(start);
    startTime = hhmm(start);
    endTime = toDateKey(end) === date ? hhmm(end) : '23:59';
  }
  const recurrence = (event.recurrence || []).map((line) =>
    // Google may rewrite EXDATE time zones; compare in our own zone
    line.startsWith('EXDATE;TZID=') ? `EXDATE;TZID=${tz}:${line.slice(line.indexOf(':') + 1)}` : line);
  return { title: event.summary || '', notes: event.description || '', date, allDay, startTime, endTime, recurrence };
}

function toGoogleBody(content, key, tz, extraDescription = '') {
  const body = {
    summary: content.title,
    description: content.notes + extraDescription,
    start: content.allDay ? { date: content.date } : { dateTime: `${content.date}T${content.startTime}:00`, timeZone: tz },
    end: content.allDay
      ? { date: addDaysToKey(content.date, 1) }
      : { dateTime: `${content.date}T${content.endTime}:00`, timeZone: tz },
    recurrence: content.recurrence,
    extendedProperties: { private: { tsKey: key, tsHash: hash(content) } },
  };
  return body;
}

// After writing, remember the hash of Google's stored version too, so later
// runs don't mistake Google's own normalisation for a user edit.
async function writeEvent(token, path, key, content, tz, { eventId, footer = '' } = {}) {
  const body = toGoogleBody(content, key, tz, footer);
  const saved = eventId
    ? await googleRequest(token, `${path}/${encodeURIComponent(eventId)}`, { method: 'PUT', body })
    : await googleRequest(token, path, { method: 'POST', body });
  const googleHash = hash(googleContent(saved, tz));
  const { tsHash } = body.extendedProperties.private;
  if (googleHash !== tsHash && !footer) {
    await setHashes(token, path, saved.id, key, tsHash, googleHash);
  }
  return saved;
}

async function setHashes(token, path, eventId, key, tsHash, tsGHash) {
  await googleRequest(token, `${path}/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: { extendedProperties: { private: { tsKey: key, tsHash, tsGHash } } },
  });
}

// ---------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------

export async function googleRequest(token, path, { method = 'GET', body, params } = {}) {
  const url = `${API}${path}${params ? `?${new URLSearchParams(params)}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    let reason = '';
    try { reason = (await res.json())?.error?.errors?.[0]?.reason || ''; } catch { /* ignore */ }
    const err = new Error(`Google Calendar ${method} failed (${res.status})`);
    err.status = res.status;
    err.reason = reason;
    throw err;
  }
  return res.json();
}

async function listAll(token, path, params) {
  const items = [];
  let pageToken;
  do {
    const data = await googleRequest(token, path, { params: { ...params, ...(pageToken ? { pageToken } : {}) } });
    items.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken && items.length < 10000);
  return items;
}

export async function listCalendars(token) {
  return listAll(token, '/users/me/calendarList', { minAccessRole: 'reader' });
}

async function ensureSyncCalendar(token, calendars) {
  const existing = calendars.find(isSyncCalendar);
  if (existing) return existing.id;
  const created = await googleRequest(token, '/calendars', {
    method: 'POST',
    body: {
      summary: SYNC_CALENDAR_NAME,
      description: `Events, deadlines and other Google accounts synced by the Thinking Space app. ${SYNC_CALENDAR_MARKER}`,
      timeZone: localTimeZone(),
    },
  });
  return created.id;
}

// Events from an account's own calendars (not its sync calendar) to copy into the others
async function fetchMirrorSource(email, token, calendars, hiddenCalendars = []) {
  const hidden = new Set(hiddenCalendars);
  const today = toDateKey(new Date());
  const timeMin = new Date(`${addDaysToKey(today, -MIRROR_WINDOW.back)}T00:00:00`).toISOString();
  const timeMax = new Date(`${addDaysToKey(today, MIRROR_WINDOW.ahead)}T00:00:00`).toISOString();
  const sources = calendars.filter((c) => !isSyncCalendar(c) && !hidden.has(c.id));
  const events = [];
  for (const calendar of sources) {
    const items = await listAll(token, `/calendars/${encodeURIComponent(calendar.id)}/events`, {
      timeMin, timeMax, singleEvents: 'true', maxResults: '2500',
    });
    for (const event of items) {
      if (event.status === 'cancelled' || event.extendedProperties?.private?.tsKey) continue;
      if (!event.start?.date && !event.start?.dateTime) continue;
      events.push({ email, calendar, event });
      if (events.length >= MAX_MIRRORED_PER_ACCOUNT) return events;
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// Reconcile
// ---------------------------------------------------------------------------

const updatedMs = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Sync every connected account. Returns { results: { [email]: { error?, stats } }, appChanged }.
 * `accounts`: [{ email, token, hiddenCalendars, syncEnabled }] (only ones with a valid token)
 * `app`: { events, deadlines, updateEvent, deleteEvent, updateDeadline, deleteDeadline }
 */
export async function syncGoogleAccounts(accounts, app) {
  const tz = localTimeZone();
  const results = {};

  // 1. Calendar lists + mirror sources for every account we can read
  const prepared = [];
  for (const account of accounts) {
    try {
      const calendars = await listCalendars(account.token);
      prepared.push({ ...account, calendars });
    } catch (e) {
      results[account.email] = { error: e };
    }
  }
  const mirrorSources = {};
  for (const account of prepared) {
    try {
      mirrorSources[account.email] = await fetchMirrorSource(account.email, account.token, account.calendars, account.hiddenCalendars);
    } catch (e) {
      mirrorSources[account.email] = null; // unknown: don't delete this account's copies elsewhere
      console.warn(`Could not read ${account.email} for copying:`, e);
    }
  }

  // Desired app content (shared by all accounts)
  const appDesired = new Map();
  for (const item of app.events) {
    if (item.kind !== 'event' || !item.date) continue;
    appDesired.set(`e:${item.id}`, { kind: 'event', item, content: appEventContent(item) });
  }
  for (const deadline of app.deadlines) {
    if (!deadline.date) continue;
    appDesired.set(`d:${deadline.id}`, { kind: 'deadline', item: deadline, content: deadlineContent(deadline) });
  }

  // 2. Reconcile each account that has sync switched on
  for (const account of prepared) {
    if (!account.syncEnabled) continue;
    const stats = { created: 0, updated: 0, deleted: 0, pulled: 0 };
    try {
      const calendarId = await ensureSyncCalendar(account.token, account.calendars);
      const path = `/calendars/${encodeURIComponent(calendarId)}/events`;
      const existing = await listAll(account.token, path, { showDeleted: 'true', maxResults: '2500' });

      const byKey = new Map();
      const deletedOccurrences = new Map(); // key → dates deleted from a repeating event in Google
      for (const event of existing) {
        const key = event.extendedProperties?.private?.tsKey;
        if (!key) continue;
        if (event.recurringEventId) {
          // Exceptions to a repeating event share its tsKey
          if (event.status === 'cancelled' && event.originalStartTime) {
            const original = event.originalStartTime.date || toDateKey(new Date(event.originalStartTime.dateTime));
            if (!deletedOccurrences.has(key)) deletedOccurrences.set(key, []);
            deletedOccurrences.get(key).push(original);
          }
          continue;
        }
        const current = byKey.get(key);
        // Prefer the live copy if a cancelled duplicate exists
        if (!current || (current.status === 'cancelled' && event.status !== 'cancelled')) byKey.set(key, event);
        else if (event.status !== 'cancelled') {
          await googleRequest(account.token, `${path}/${encodeURIComponent(event.id)}`, { method: 'DELETE' }).catch(() => {});
        }
      }

      // Desired copies of the other accounts' events
      const mirrorDesired = new Map();
      const unknownOrigins = new Set();
      for (const other of prepared) {
        if (other.email === account.email) continue;
        const source = mirrorSources[other.email];
        if (!source) { unknownOrigins.add(other.email); continue; }
        for (const { email, calendar, event } of source) {
          const key = `m:${email}|${calendar.id}|${event.id}`;
          const content = { ...googleContent(event, tz), recurrence: [] };
          mirrorDesired.set(key, { content, footer: `\n\n— Copied from ${email} (${calendar.summaryOverride || calendar.summary})` });
        }
      }

      // App events and deadlines
      for (const [key, desired] of appDesired) {
        const event = byKey.get(key);
        const appHash = hash(desired.content);
        if (!event) {
          await writeEvent(account.token, path, key, desired.content, tz);
          stats.created++;
          continue;
        }

        if (event.status === 'cancelled') {
          // Deleted in Google → delete in the app
          if (desired.kind === 'event') await app.deleteEvent(desired.item.id);
          else await app.deleteDeadline(desired.item.id);
          stats.pulled++;
          results[account.email] = { stats, calendarId };
          return { results, appChanged: true };
        }

        // Occurrences deleted in Google become skipped dates in the app
        const newlyDeleted = (deletedOccurrences.get(key) || []).filter((d) => !(desired.item.exdates || []).includes(d));
        if (desired.kind === 'event' && newlyDeleted.length) {
          await app.updateEvent(desired.item.id, { exdates: [...(desired.item.exdates || []), ...newlyDeleted] });
          stats.pulled++;
          results[account.email] = { stats, calendarId };
          return { results, appChanged: true };
        }

        const { tsHash, tsGHash } = event.extendedProperties.private;
        const google = googleContent(event, tz);
        const googleHash = hash(google);
        const appEdited = appHash !== tsHash;
        const googleEdited = googleHash !== (tsGHash || tsHash);
        if (!appEdited && !googleEdited) continue;

        if (appHash === googleHash) {
          await setHashes(account.token, path, event.id, key, appHash, googleHash);
          continue;
        }

        const googleWins = googleEdited && (!appEdited || new Date(event.updated).getTime() > updatedMs(desired.item.updatedAt));
        if (!googleWins) {
          await writeEvent(account.token, path, key, desired.content, tz, { eventId: event.id });
          stats.updated++;
          continue;
        }

        // Edited in Google → update the app, then record both hashes so it isn't pushed back
        let pulledContent;
        if (desired.kind === 'event') {
          const { recurrence, exdates } = fromRecurrenceLines(event.recurrence);
          const updates = {
            title: google.title,
            notes: google.notes,
            date: google.date,
            allDay: google.allDay,
            startTime: google.startTime,
            endTime: google.endTime,
            recurrence,
            exdates,
          };
          await app.updateEvent(desired.item.id, updates);
          pulledContent = appEventContent({ ...desired.item, ...updates });
        } else {
          const title = google.title.startsWith(DEADLINE_PREFIX) ? google.title.slice(DEADLINE_PREFIX.length) : google.title;
          await app.updateDeadline(desired.item.id, { title, date: google.date });
          pulledContent = deadlineContent({ ...desired.item, title, date: google.date });
        }
        await setHashes(account.token, path, event.id, key, hash(pulledContent), googleHash);
        stats.pulled++;
        // App data is now stale for the remaining accounts; the next run continues
        results[account.email] = { stats, calendarId };
        return { results, appChanged: true };
      }

      // Copies of other accounts' events (always overwritten from the original)
      for (const [key, desired] of mirrorDesired) {
        const event = byKey.get(key);
        if (!event) {
          await writeEvent(account.token, path, key, desired.content, tz, { footer: desired.footer });
          stats.created++;
          continue;
        }
        if (event.status === 'cancelled') continue; // a copy deleted in this account stays deleted
        if (event.extendedProperties.private.tsHash !== hash(desired.content)) {
          await writeEvent(account.token, path, key, desired.content, tz, { eventId: event.id, footer: desired.footer });
          stats.updated++;
        }
      }

      // Safety stop: if the app suddenly looks empty (e.g. data failed to load),
      // don't wipe the Google copies
      const liveAppKeys = [...byKey].filter(([key, event]) => event.status !== 'cancelled' && (key.startsWith('e:') || key.startsWith('d:')));
      const appDeletes = liveAppKeys.filter(([key]) => !appDesired.has(key)).length;
      if (appDeletes > 10 && appDeletes > liveAppKeys.length / 2) {
        const err = new Error(`Sync paused: it would remove ${appDeletes} events from Google Calendar at once. Reload the app; if you really deleted them, delete the "Thinking Space" calendar in Google and it will be rebuilt.`);
        err.code = 'mass-delete';
        throw err;
      }

      // Remove what no longer exists in the app / the original account
      for (const [key, event] of byKey) {
        if (event.status === 'cancelled') continue;
        const isApp = key.startsWith('e:') || key.startsWith('d:');
        if (isApp && appDesired.has(key)) continue;
        if (key.startsWith('m:')) {
          if (mirrorDesired.has(key)) continue;
          const origin = key.slice(2, key.indexOf('|'));
          // Keep copies whose original account we couldn't read or is disconnected right now
          if (unknownOrigins.has(origin) || !prepared.some((a) => a.email === origin)) continue;
          // Keep copies outside the copy window rather than deleting history
          const start = event.start?.date || (event.start?.dateTime && toDateKey(new Date(event.start.dateTime)));
          const today = toDateKey(new Date());
          if (start && (start < addDaysToKey(today, -MIRROR_WINDOW.back) || start > addDaysToKey(today, MIRROR_WINDOW.ahead))) continue;
        }
        await googleRequest(account.token, `${path}/${encodeURIComponent(event.id)}`, { method: 'DELETE' }).catch((e) => {
          if (e.status !== 410 && e.status !== 404) throw e;
        });
        stats.deleted++;
      }

      results[account.email] = { stats, calendarId };
    } catch (e) {
      results[account.email] = { error: e, stats };
    }
  }

  return { results, appChanged: false };
}
