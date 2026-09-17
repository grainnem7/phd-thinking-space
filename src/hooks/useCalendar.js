import { useState, useEffect, useCallback } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { toDateKey } from '../utils/date';

// Calendar items live in users/{uid}/calendarItems. Two kinds share the collection:
//   event: { kind: 'event', title, date: 'YYYY-MM-DD', allDay, startTime, endTime, color, notes, links }
//   todo:  { kind: 'todo',  title, date: 'YYYY-MM-DD', completed, order }
// links: [{ type: 'note' | 'paper', id, name }]

const DEMO_KEY = 'demo-calendarItems';

function loadDemoItems() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(DEMO_KEY)); } catch { /* ignore */ }
  if (Array.isArray(saved)) return saved;
  const initial = demoItems();
  sessionStorage.setItem(DEMO_KEY, JSON.stringify(initial));
  return initial;
}

function demoItems() {
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return toDateKey(d);
  };
  return [
    { id: 'demo-cal-1', kind: 'event', title: 'Supervision meeting', date: day(1), allDay: false, startTime: '10:00', endTime: '11:00', color: 'violet', notes: 'Bring chapter 3 outline', links: [] },
    { id: 'demo-cal-2', kind: 'event', title: 'Writing retreat', date: day(4), allDay: true, color: 'emerald', notes: '', links: [] },
    { id: 'demo-cal-3', kind: 'event', title: 'Reading group', date: day(0), allDay: false, startTime: '15:00', endTime: '16:00', color: 'sky', notes: '', links: [] },
    { id: 'demo-cal-4', kind: 'todo', title: 'Draft methods section intro', date: day(0), completed: false, order: 0 },
    { id: 'demo-cal-5', kind: 'todo', title: 'Reply to ethics committee', date: day(0), completed: true, order: 1 },
  ];
}

export function useCalendar() {
  const { user, isDemo } = useAuth();
  // Demo data is read once up front; signed-in data arrives through the snapshot listener.
  const [items, setItems] = useState(() => (isDemo ? loadDemoItems() : []));
  const [isLoading, setIsLoading] = useState(!isDemo);

  useEffect(() => {
    if (!user || isDemo) return;

    const q = query(collection(db, 'users', user.uid, 'calendarItems'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    }, (error) => {
      console.error('Error subscribing to calendar items:', error);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [user, isDemo]);

  const updateDemo = useCallback((fn) => {
    setItems((prev) => {
      const next = fn(prev);
      sessionStorage.setItem(DEMO_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addItem = useCallback(async (item) => {
    if (!user) return;
    const data = { ...item, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

    if (isDemo) {
      updateDemo((prev) => [...prev, { id: `demo-cal-${Date.now()}`, ...data }]);
      return;
    }
    try {
      await addDoc(collection(db, 'users', user.uid, 'calendarItems'), data);
    } catch (error) {
      console.error('Error adding calendar item:', error);
    }
  }, [user, isDemo, updateDemo]);

  const updateItem = useCallback(async (id, updates) => {
    if (!user) return;
    const data = { ...updates, updatedAt: new Date().toISOString() };

    if (isDemo) {
      updateDemo((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)));
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid, 'calendarItems', id), data);
    } catch (error) {
      console.error('Error updating calendar item:', error);
    }
  }, [user, isDemo, updateDemo]);

  const deleteItem = useCallback(async (id) => {
    if (!user) return;

    if (isDemo) {
      updateDemo((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'calendarItems', id));
    } catch (error) {
      console.error('Error deleting calendar item:', error);
    }
  }, [user, isDemo, updateDemo]);

  // Move several items to another date in one write (used for "move unfinished to-dos").
  const moveItems = useCallback(async (ids, date) => {
    if (!user || ids.length === 0) return;
    const updatedAt = new Date().toISOString();

    if (isDemo) {
      const idSet = new Set(ids);
      updateDemo((prev) => prev.map((i) => (idSet.has(i.id) ? { ...i, date, updatedAt } : i)));
      return;
    }
    try {
      const batch = writeBatch(db);
      ids.forEach((id) => batch.update(doc(db, 'users', user.uid, 'calendarItems', id), { date, updatedAt }));
      await batch.commit();
    } catch (error) {
      console.error('Error moving calendar items:', error);
    }
  }, [user, isDemo, updateDemo]);

  return {
    items: user ? items : [],
    isLoading: Boolean(user) && !isDemo && isLoading,
    addItem,
    updateItem,
    deleteItem,
    moveItems,
  };
}
