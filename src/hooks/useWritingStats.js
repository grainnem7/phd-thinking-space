import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { toDateKey, parseLocalDate } from '../utils/date';

// Daily word-count snapshots:
//   users/{uid}/writingStats/{YYYY-MM-DD} -> { date, totalWords, updatedAt }
//   users/{uid}/settings/writing          -> { dailyGoal }
// Demo mode: sessionStorage 'demo-writingStats' (array) and 'demo-writingSettings'.
//
// Words written on a day = that day's total minus the most recent earlier
// snapshot's total (never negative). The first snapshot ever is measured from
// `startWords` (its total when tracking began), so notes that existed before
// tracking started aren't counted as new writing.

export const DEFAULT_DAILY_GOAL = 500;

const STATS_KEY = 'demo-writingStats';
const SETTINGS_KEY = 'demo-writingSettings';
const EMPTY = [];
const NO_SETTINGS = {};

// ---------------------------------------------------------------------------
// sessionStorage-backed values shared by every hook instance in this tab
// (the recorder writes, the widget and weekly review read).

const demoListeners = new Set();
const demoCache = new Map();

function subscribeDemo(listener) {
  demoListeners.add(listener);
  return () => demoListeners.delete(listener);
}

export function readDemoValue(key, fallback) {
  let raw = null;
  try { raw = sessionStorage.getItem(key); } catch { /* ignore */ }
  const cached = demoCache.get(key);
  if (cached && cached.raw === raw) return cached.value;
  let value = fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed != null) value = parsed;
  } catch { /* ignore */ }
  demoCache.set(key, { raw, value });
  return value;
}

export function writeDemoValue(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  demoListeners.forEach((l) => l());
}

export function useDemoValue(key, fallback, enabled) {
  return useSyncExternalStore(
    subscribeDemo,
    () => (enabled ? readDemoValue(key, fallback) : fallback),
    () => fallback,
  );
}

// ---------------------------------------------------------------------------
// Pure helpers

// One snapshot per date (a migrated demo copy and a later date-keyed doc can
// coexist: prefer the doc whose id is the date, else the larger total).
export function normalizeSnapshots(items) {
  const byDate = new Map();
  for (const item of items) {
    if (!item?.date || typeof item.totalWords !== 'number') continue;
    const existing = byDate.get(item.date);
    if (!existing
      || (item.id === item.date && existing.id !== existing.date)
      || (existing.id !== existing.date && item.totalWords > existing.totalWords)) {
      byDate.set(item.date, item);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Map of 'YYYY-MM-DD' -> words written that day (only dates with a snapshot)
export function wordsWrittenByDate(snapshots) {
  const map = new Map();
  snapshots.forEach((s, i) => {
    const prev = i > 0 ? snapshots[i - 1].totalWords : (s.startWords ?? s.totalWords);
    map.set(s.date, Math.max(0, s.totalWords - prev));
  });
  return map;
}

function shiftDay(dateKey, delta) {
  const d = parseLocalDate(dateKey);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

// Consecutive days meeting the goal, ending today if today's goal is met,
// otherwise ending yesterday.
export function currentStreak(writtenByDate, goal, today = toDateKey(new Date())) {
  if (!goal || goal <= 0) return 0;
  let day = (writtenByDate.get(today) || 0) >= goal ? today : shiftDay(today, -1);
  let streak = 0;
  while ((writtenByDate.get(day) || 0) >= goal) {
    streak += 1;
    day = shiftDay(day, -1);
  }
  return streak;
}

// [{ date, words }] for `count` days ending at `endKey` (inclusive)
export function dailySeries(writtenByDate, endKey, count) {
  return Array.from({ length: count }, (_, i) => {
    const date = shiftDay(endKey, i - count + 1);
    return { date, words: writtenByDate.get(date) || 0 };
  });
}

// ---------------------------------------------------------------------------

export function useWritingStats() {
  const { user, isDemo } = useAuth();
  const uid = user?.uid ?? null;
  const live = Boolean(uid) && !isDemo;

  const [remote, setRemote] = useState({ uid: null, items: EMPTY });
  const [remoteSettings, setRemoteSettings] = useState({ uid: null, data: NO_SETTINGS });

  useEffect(() => {
    if (!live) return undefined;
    const unsubStats = onSnapshot(collection(db, 'users', uid, 'writingStats'), (snap) => {
      setRemote({ uid, items: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
    }, (error) => {
      console.error('Error loading writing stats:', error);
      setRemote({ uid, items: EMPTY, error });
    });
    const unsubSettings = onSnapshot(doc(db, 'users', uid, 'settings', 'writing'), (snap) => {
      setRemoteSettings({ uid, data: snap.data() || NO_SETTINGS });
    }, (error) => {
      console.error('Error loading writing settings:', error);
      setRemoteSettings({ uid, data: NO_SETTINGS });
    });
    return () => {
      unsubStats();
      unsubSettings();
    };
  }, [live, uid]);

  const demoStats = useDemoValue(STATS_KEY, null, isDemo);
  const demoSettings = useDemoValue(SETTINGS_KEY, NO_SETTINGS, isDemo);

  let rawItems = EMPTY;
  let loaded = false;
  let settings = NO_SETTINGS;
  if (uid && isDemo) {
    rawItems = Array.isArray(demoStats) ? demoStats : EMPTY;
    loaded = true;
    settings = demoSettings;
  } else if (live) {
    rawItems = remote.uid === uid ? remote.items : EMPTY;
    loaded = remote.uid === uid && !remote.error;
    settings = remoteSettings.uid === uid ? remoteSettings.data : NO_SETTINGS;
  }

  const snapshots = useMemo(() => normalizeSnapshots(rawItems), [rawItems]);
  const writtenByDate = useMemo(() => wordsWrittenByDate(snapshots), [snapshots]);
  const dailyGoal = Number(settings?.dailyGoal) > 0 ? Number(settings.dailyGoal) : DEFAULT_DAILY_GOAL;

  // Upsert today's (or `date`'s) total if it changed. Returns true if written.
  const recordTotal = useCallback(async (totalWords, date = toDateKey(new Date())) => {
    if (!uid) return false;
    // The very first snapshot remembers the total it started from, so writing
    // done later that same day still counts (but pre-existing notes don't).
    const firstFields = (items) => (items.length === 0 ? { startWords: totalWords } : {});

    if (isDemo) {
      const stored = readDemoValue(STATS_KEY, null);
      const items = Array.isArray(stored) ? stored : EMPTY;
      const existing = items.find((s) => s.date === date);
      if (existing && existing.totalWords === totalWords) return false;
      const entry = { id: date, date, totalWords, updatedAt: new Date().toISOString(), ...firstFields(items) };
      writeDemoValue(STATS_KEY, existing
        ? items.map((s) => (s.date === date ? { ...s, ...entry } : s))
        : [...items, entry]);
      return true;
    }
    const items = normalizeSnapshots(remote.uid === uid ? remote.items : EMPTY);
    const existing = items.find((s) => s.date === date);
    if (existing && existing.totalWords === totalWords) return false;
    try {
      await setDoc(
        doc(db, 'users', uid, 'writingStats', date),
        { date, totalWords, updatedAt: serverTimestamp(), ...firstFields(items) },
        { merge: true },
      );
      return true;
    } catch (error) {
      console.error('Error saving writing stats:', error);
      return false;
    }
  }, [uid, isDemo, remote]);

  const setDailyGoal = useCallback(async (goal) => {
    const value = Math.max(0, Math.round(Number(goal) || 0));
    if (!uid) return;
    if (isDemo) {
      writeDemoValue(SETTINGS_KEY, { ...readDemoValue(SETTINGS_KEY, NO_SETTINGS), dailyGoal: value });
      return;
    }
    try {
      await setDoc(doc(db, 'users', uid, 'settings', 'writing'), { dailyGoal: value, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error('Error saving writing goal:', error);
    }
  }, [uid, isDemo]);

  return { snapshots, writtenByDate, dailyGoal, loaded, recordTotal, setDailyGoal };
}
