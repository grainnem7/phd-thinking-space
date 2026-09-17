import { useState, useEffect, useCallback, useMemo, createContext, useContext, createElement } from 'react';
import { collection, doc, onSnapshot, query, orderBy, writeBatch, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { SUGGESTED_CATEGORIES } from '../components/calendar/categoryColors';

// Calendar categories: users/{uid}/calendarCategories/{id} → { name, color, order }.
// Events reference one by `categoryId`. Demo mode keeps them in sessionStorage.

const DEMO_KEY = 'demo-calendarCategories';

function demoId() {
  return `demo-cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadDemo() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DEMO_KEY));
    if (Array.isArray(saved)) return saved;
  } catch { /* ignore */ }
  const initial = SUGGESTED_CATEGORIES.map((c, order) => ({ id: `demo-cat-${c.name.toLowerCase()}`, ...c, order }));
  sessionStorage.setItem(DEMO_KEY, JSON.stringify(initial));
  return initial;
}

function useCategoriesState() {
  const { user, isDemo } = useAuth();
  const [categories, setCategories] = useState(() => (isDemo ? loadDemo() : []));

  useEffect(() => {
    if (!user || isDemo) return;
    const q = query(collection(db, 'users', user.uid, 'calendarCategories'), orderBy('order', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setCategories(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => console.error('Error loading calendar categories:', error));
  }, [user, isDemo]);

  const updateDemo = useCallback((fn) => {
    setCategories((prev) => {
      const next = fn(prev);
      sessionStorage.setItem(DEMO_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Add one or more categories at the end of the list
  const addCategories = useCallback(async (list) => {
    if (!user || list.length === 0) return;
    const start = categories.reduce((max, c) => Math.max(max, c.order ?? 0), -1) + 1;
    if (isDemo) {
      updateDemo((prev) => [...prev, ...list.map((c, i) => ({ id: demoId(), name: c.name, color: c.color, order: start + i }))]);
      return;
    }
    const batch = writeBatch(db);
    const coll = collection(db, 'users', user.uid, 'calendarCategories');
    list.forEach((c, i) => batch.set(doc(coll), { name: c.name, color: c.color, order: start + i }));
    await batch.commit();
  }, [user, isDemo, categories, updateDemo]);

  const updateCategory = useCallback(async (id, updates) => {
    if (!user) return;
    if (isDemo) {
      updateDemo((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
      return;
    }
    await updateDoc(doc(db, 'users', user.uid, 'calendarCategories', id), updates);
  }, [user, isDemo, updateDemo]);

  // Events keep their categoryId; they simply show their own colour afterwards
  const deleteCategory = useCallback(async (id) => {
    if (!user) return;
    if (isDemo) {
      updateDemo((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    await deleteDoc(doc(db, 'users', user.uid, 'calendarCategories', id));
  }, [user, isDemo, updateDemo]);

  const list = useMemo(() => (user ? categories : []), [user, categories]);
  const byId = useMemo(() => new Map(list.map((c) => [c.id, c])), [list]);

  return useMemo(() => ({
    categories: list,
    categoriesById: byId,
    addCategories,
    updateCategory,
    deleteCategory,
  }), [list, byId, addCategories, updateCategory, deleteCategory]);
}

const CalendarCategoriesContext = createContext(null);

export function CalendarCategoriesProvider({ children }) {
  const value = useCategoriesState();
  return createElement(CalendarCategoriesContext.Provider, { value }, children);
}

export function useCalendarCategories() {
  const context = useContext(CalendarCategoriesContext);
  if (!context) throw new Error('useCalendarCategories must be used within a CalendarCategoriesProvider');
  return context;
}
