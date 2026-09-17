import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useDemoValue, writeDemoValue } from './useWritingStats';

// Home screen layout, per account:
//   users/{uid}/dashboard/config -> { widgets: [{ id, visible, size }], updatedAt }
// Demo mode: sessionStorage 'demo-dashboardLayout' with the same shape.

export const WIDGET_SIZES = [
  { id: 'small', label: 'Small', short: 'S', hint: 'a third of the row' },
  { id: 'medium', label: 'Medium', short: 'M', hint: 'about half the row' },
  { id: 'wide', label: 'Wide', short: 'W', hint: 'full row' },
];

// Registry, in default order. New widgets added here show up for everyone
// (appended to saved layouts with these defaults).
export const DASHBOARD_WIDGETS = [
  { id: 'deadlines', title: 'Deadlines', size: 'small' },
  { id: 'schedule', title: 'Schedule', size: 'medium' },
  { id: 'todo', title: 'Todo', size: 'small' },
  { id: 'calendar', title: 'Calendar', size: 'wide' },
  { id: 'quickCapture', title: 'Quick Capture', size: 'small' },
  { id: 'pomodoro', title: 'Focus Timer', size: 'small' },
  { id: 'recentNotes', title: 'Recent Notes', size: 'small' },
  { id: 'writing', title: 'Writing', size: 'wide' },
];

const DEMO_KEY = 'demo-dashboardLayout';
const KNOWN = new Map(DASHBOARD_WIDGETS.map((w) => [w.id, w]));
const SIZE_IDS = new Set(WIDGET_SIZES.map((s) => s.id));

export function defaultLayout() {
  return DASHBOARD_WIDGETS.map(({ id, size }) => ({ id, visible: true, size }));
}

// Known widgets in saved order (deduped, sizes validated), then any widgets the
// saved layout doesn't mention yet, with their defaults.
export function normalizeLayout(stored) {
  if (!Array.isArray(stored)) return defaultLayout();
  const seen = new Set();
  const widgets = [];
  for (const w of stored) {
    if (!w || !KNOWN.has(w.id) || seen.has(w.id)) continue;
    seen.add(w.id);
    widgets.push({
      id: w.id,
      visible: w.visible !== false,
      size: SIZE_IDS.has(w.size) ? w.size : KNOWN.get(w.id).size,
    });
  }
  for (const def of DASHBOARD_WIDGETS) {
    if (!seen.has(def.id)) widgets.push({ id: def.id, visible: true, size: def.size });
  }
  return widgets;
}

const LG_NOMINAL = { small: 4, medium: 6, wide: 12 };
// Up to this many columns' worth of widgets may share a 12-column row; the row
// is then shrunk proportionally (small + medium + small -> 4 / 5 / 3).
const LG_ROW_LIMIT = 14;

// Column spans for the visible widgets, in order: { [id]: { lg: 1-12, md: 3|6 } }
export function computeSpans(widgets) {
  const spans = {};

  // Large screens: 12 columns
  const rows = [];
  let row = [];
  let sum = 0;
  for (const w of widgets) {
    const span = LG_NOMINAL[w.size] || 4;
    if (row.length && sum + span > LG_ROW_LIMIT) {
      rows.push(row);
      row = [];
      sum = 0;
    }
    row.push({ id: w.id, span });
    sum += span;
  }
  if (row.length) rows.push(row);

  for (const r of rows) {
    const total = r.reduce((n, c) => n + c.span, 0);
    if (total <= 12) {
      r.forEach((c) => { spans[c.id] = { lg: c.span }; });
      continue;
    }
    // Largest-remainder rounding to exactly 12 (ties go to the earlier widget)
    const exact = r.map((c) => (c.span * 12) / total);
    const cols = exact.map(Math.floor);
    let left = 12 - cols.reduce((n, c) => n + c, 0);
    const order = exact.map((e, i) => ({ i, rem: e - cols[i] })).sort((a, b) => b.rem - a.rem || a.i - b.i);
    for (const { i } of order) {
      if (left <= 0) break;
      cols[i] += 1;
      left -= 1;
    }
    r.forEach((c, i) => { spans[c.id] = { lg: cols[i] }; });
  }

  // Tablets: 6 columns; small and medium take half, a half left alone in its row takes the full width
  let pending = null;
  for (const w of widgets) {
    if (w.size === 'wide') {
      if (pending) spans[pending].md = 6;
      pending = null;
      spans[w.id].md = 6;
    } else if (pending) {
      spans[pending].md = 3;
      spans[w.id].md = 3;
      pending = null;
    } else {
      pending = w.id;
    }
  }
  if (pending) spans[pending].md = 6;

  return spans;
}

const sameLayout = (a, b) => JSON.stringify(normalizeLayout(a)) === JSON.stringify(normalizeLayout(b));

export function useDashboardLayout() {
  const { user, isDemo } = useAuth();
  const uid = user?.uid ?? null;
  const live = Boolean(uid) && !isDemo;

  const [remote, setRemote] = useState({ uid: null, widgets: null });
  // Saved locally but not yet echoed back by the listener
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (!live) return undefined;
    return onSnapshot(doc(db, 'users', uid, 'dashboard', 'config'), (snap) => {
      const widgets = snap.data()?.widgets ?? null;
      setRemote({ uid, widgets });
      setPending((prev) => (prev && prev.uid === uid && sameLayout(prev.widgets, widgets) ? null : prev));
    }, (error) => {
      console.error('Error loading dashboard layout:', error);
      setRemote({ uid, widgets: null });
    });
  }, [live, uid]);

  const demoValue = useDemoValue(DEMO_KEY, null, isDemo);

  let stored = null;
  let loaded = true;
  if (uid && isDemo) {
    stored = demoValue?.widgets ?? null;
  } else if (live) {
    loaded = remote.uid === uid;
    stored = pending?.uid === uid ? pending.widgets : (loaded ? remote.widgets : null);
  }

  const widgets = useMemo(() => normalizeLayout(stored), [stored]);

  const save = useCallback(async (next) => {
    if (!uid) return;
    const data = { widgets: next.map(({ id, visible, size }) => ({ id, visible, size })) };
    if (isDemo) {
      writeDemoValue(DEMO_KEY, { ...data, updatedAt: new Date().toISOString() });
      return;
    }
    setPending({ uid, widgets: data.widgets });
    try {
      await setDoc(doc(db, 'users', uid, 'dashboard', 'config'), { ...data, updatedAt: serverTimestamp() });
    } catch (error) {
      console.error('Error saving dashboard layout:', error);
      setPending(null);
    }
  }, [uid, isDemo]);

  // Reorder so the visible widgets follow `visibleIds`; hidden widgets keep their slots
  const reorderVisible = useCallback((visibleIds) => {
    const byId = new Map(widgets.map((w) => [w.id, w]));
    const queue = visibleIds.filter((id) => byId.get(id)?.visible);
    let i = 0;
    const next = widgets.map((w) => (w.visible ? byId.get(queue[i++]) || w : w));
    save(next);
  }, [widgets, save]);

  const setVisible = useCallback((id, visible) => {
    const target = widgets.find((w) => w.id === id);
    if (!target) return;
    const rest = widgets.filter((w) => w.id !== id);
    // Re-added widgets go to the end, where they're easy to spot
    save(visible ? [...rest, { ...target, visible: true }] : widgets.map((w) => (w.id === id ? { ...w, visible: false } : w)));
  }, [widgets, save]);

  const setSize = useCallback((id, size) => {
    if (!SIZE_IDS.has(size)) return;
    save(widgets.map((w) => (w.id === id ? { ...w, size } : w)));
  }, [widgets, save]);

  const resetLayout = useCallback(() => save(defaultLayout()), [save]);

  return { widgets, loaded, reorderVisible, setVisible, setSize, resetLayout };
}
