import { useState, useEffect, useCallback } from 'react';
import { doc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { parseLocalDate, toDateKey } from '../utils/date';

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

const demoDeadlines = () => [
  { id: 'demo-deadline-1', title: 'Submit literature review', date: daysFromNow(3) },
  { id: 'demo-deadline-2', title: 'Advisor meeting', date: daysFromNow(7) },
  { id: 'demo-deadline-3', title: 'Conference paper deadline', date: daysFromNow(14) },
];

const demoScheduleBlocks = () => [
  { id: 'demo-block-1', title: 'Deep work - Writing', startTime: '09:00', endTime: '12:00' },
  { id: 'demo-block-2', title: 'Lunch break', startTime: '12:00', endTime: '13:00' },
  { id: 'demo-block-3', title: 'Reading & Research', startTime: '14:00', endTime: '16:00' },
];

const demoQuickCaptures = () => [
  { id: 'demo-capture-1', text: 'Look into transformer attention mechanisms', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: 'demo-capture-2', text: 'Schedule meeting with co-author', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
];

const demoTodos = () => [
  { id: 'demo-todo-1', title: 'Review methodology chapter', completed: false, order: 0 },
  { id: 'demo-todo-2', title: 'Update bibliography', completed: true, order: 1 },
  { id: 'demo-todo-3', title: 'Email supervisor', completed: false, order: 2 },
];

function loadDemo(key, defaults) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key));
    if (Array.isArray(saved)) return saved;
  } catch { /* ignore */ }
  const initial = defaults();
  sessionStorage.setItem(key, JSON.stringify(initial));
  return initial;
}

// A live users/{uid}/{name} collection, or a sessionStorage-backed list in demo mode.
function useUserCollection({ name, order, direction = 'asc', max, demoKey, demoDefaults, prepend = false }) {
  const { user, isDemo } = useAuth();
  const [items, setItems] = useState(() => (isDemo ? loadDemo(demoKey, demoDefaults) : []));
  const [loaded, setLoaded] = useState(isDemo);

  useEffect(() => {
    if (!user || isDemo) return;
    const constraints = [orderBy(order, direction)];
    if (max) constraints.push(limit(max));
    return onSnapshot(query(collection(db, 'users', user.uid, name), ...constraints), (snapshot) => {
      setItems(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoaded(true);
    }, (error) => {
      console.error(`Error loading ${name}:`, error);
      setLoaded(true);
    });
  }, [user, isDemo, name, order, direction, max]);

  const updateDemo = useCallback((fn) => {
    setItems((prev) => {
      const next = fn(prev);
      sessionStorage.setItem(demoKey, JSON.stringify(next));
      return next;
    });
  }, [demoKey]);

  const add = useCallback(async (data) => {
    if (!user) return;
    if (isDemo) {
      const item = { id: `${demoKey}-${Date.now()}`, ...data };
      updateDemo((prev) => (prepend ? [item, ...prev] : [...prev, item]));
      return;
    }
    try {
      await addDoc(collection(db, 'users', user.uid, name), data);
    } catch (error) {
      console.error(`Error adding to ${name}:`, error);
    }
  }, [user, isDemo, name, demoKey, prepend, updateDemo]);

  const update = useCallback(async (id, updates) => {
    if (!user) return;
    if (isDemo) {
      updateDemo((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid, name, id), updates);
    } catch (error) {
      console.error(`Error updating ${name}:`, error);
    }
  }, [user, isDemo, name, updateDemo]);

  const remove = useCallback(async (id) => {
    if (!user) return;
    if (isDemo) {
      updateDemo((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', user.uid, name, id));
    } catch (error) {
      console.error(`Error deleting from ${name}:`, error);
    }
  }, [user, isDemo, name, updateDemo]);

  return { items: user ? items : [], loaded: !user || loaded, add, update, remove };
}

// Just the deadlines (read-only views such as the weekly review)
export function useDeadlines() {
  const { items, loaded } = useUserCollection({ name: 'deadlines', order: 'date', demoKey: 'demo-deadlines', demoDefaults: demoDeadlines });
  return { deadlines: items, loaded };
}

export function useDashboard() {
  const deadlines = useUserCollection({ name: 'deadlines', order: 'date', demoKey: 'demo-deadlines', demoDefaults: demoDeadlines });
  const blocks = useUserCollection({ name: 'scheduleBlocks', order: 'startTime', demoKey: 'demo-scheduleBlocks', demoDefaults: demoScheduleBlocks });
  const captures = useUserCollection({ name: 'quickCaptures', order: 'createdAt', direction: 'desc', max: 100, demoKey: 'demo-quickCaptures', demoDefaults: demoQuickCaptures, prepend: true });
  const todoList = useUserCollection({ name: 'dashboardTodos', order: 'order', demoKey: 'demo-todos', demoDefaults: demoTodos });

  // Don't hold the dashboard on a spinner if a listener is slow to report
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 2000);
    return () => clearTimeout(t);
  }, []);
  const isLoading = !timedOut && !(deadlines.loaded && blocks.loaded && captures.loaded && todoList.loaded);

  // Browser notifications for upcoming deadlines (24h, 1h) + schedule blocks (5min).
  // Fires once per item per kind per session (sessionStorage flags). Requires the
  // user to have already granted Notification permission via the Pomodoro widget
  // or system prompt — we don't auto-prompt here to avoid being intrusive.
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notifyOnce = (key, title, body) => {
      if (sessionStorage.getItem(key)) return;
      try { new Notification(title, { body, tag: key }); } catch { /* ignore */ }
      sessionStorage.setItem(key, '1');
    };

    const tick = () => {
      const now = new Date();
      const todayStr = toDateKey(now);

      for (const d of deadlines.items) {
        if (!d?.date || !d?.title) continue;
        const target = parseLocalDate(d.date);
        if (!target) continue;
        // Treat deadline as end-of-day on the target date
        target.setHours(23, 59, 59, 999);
        const hoursUntil = (target - now) / 3600000;
        if (hoursUntil > 0 && hoursUntil <= 24) notifyOnce(`notif-d-${d.id}-24h`, 'Deadline approaching', `${d.title} — due within 24h`);
        if (hoursUntil > 0 && hoursUntil <= 1) notifyOnce(`notif-d-${d.id}-1h`, 'Deadline in under an hour', d.title);
      }

      // Schedule blocks (today only, recurring daily)
      for (const b of blocks.items) {
        if (!b?.startTime || !b?.title) continue;
        const [h, m] = b.startTime.split(':').map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) continue;
        const blockStart = new Date(now);
        blockStart.setHours(h, m, 0, 0);
        const minsUntil = (blockStart - now) / 60000;
        if (minsUntil > 0 && minsUntil <= 5) notifyOnce(`notif-b-${b.id}-${todayStr}`, 'Starting in 5 minutes', `${b.title} at ${b.startTime}`);
      }
    };

    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [deadlines.items, blocks.items]);

  const { items: todos, add: addTodoDoc, update: updateTodo, remove: deleteTodo } = todoList;

  const addTodo = useCallback((todo) => addTodoDoc({
    ...todo,
    completed: false,
    order: todos.reduce((max, t) => Math.max(max, t.order ?? 0), -1) + 1,
    createdAt: new Date().toISOString(),
  }), [addTodoDoc, todos]);

  const toggleTodo = useCallback(async (id) => {
    const todo = todos.find((t) => t.id === id);
    if (todo) await updateTodo(id, { completed: !todo.completed });
  }, [todos, updateTodo]);

  return {
    // State
    deadlines: deadlines.items,
    deadlinesLoaded: deadlines.loaded,
    scheduleBlocks: blocks.items,
    quickCaptures: captures.items,
    todos,
    isLoading,

    // Actions
    addDeadline: deadlines.add,
    updateDeadline: deadlines.update,
    deleteDeadline: deadlines.remove,
    addScheduleBlock: blocks.add,
    updateScheduleBlock: blocks.update,
    deleteScheduleBlock: blocks.remove,
    addQuickCapture: captures.add,
    updateQuickCapture: captures.update,
    deleteQuickCapture: captures.remove,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
  };
}
