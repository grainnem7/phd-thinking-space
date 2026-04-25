import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

// Demo data for dashboard
const DEMO_DEADLINES = [
  { id: 'demo-deadline-1', title: 'Submit literature review', date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
  { id: 'demo-deadline-2', title: 'Advisor meeting', date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
  { id: 'demo-deadline-3', title: 'Conference paper deadline', date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
];

const DEMO_SCHEDULE_BLOCKS = [
  { id: 'demo-block-1', title: 'Deep work - Writing', startTime: '09:00', endTime: '12:00' },
  { id: 'demo-block-2', title: 'Lunch break', startTime: '12:00', endTime: '13:00' },
  { id: 'demo-block-3', title: 'Reading & Research', startTime: '14:00', endTime: '16:00' },
];

const DEMO_QUICK_CAPTURES = [
  { id: 'demo-capture-1', text: 'Look into transformer attention mechanisms', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: 'demo-capture-2', text: 'Schedule meeting with co-author', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
];

const DEMO_TODOS = [
  { id: 'demo-todo-1', title: 'Review methodology chapter', completed: false, order: 0 },
  { id: 'demo-todo-2', title: 'Update bibliography', completed: true, order: 1 },
  { id: 'demo-todo-3', title: 'Email supervisor', completed: false, order: 2 },
];

export function useDashboard() {
  const { user, isDemo } = useAuth();
  const [layout, setLayout] = useState(null);
  const [activeWidgets, setActiveWidgets] = useState(['schedule', 'deadlines', 'taskSummary', 'quickCapture', 'recentNotes']);
  const [deadlines, setDeadlines] = useState([]);
  const [scheduleBlocks, setScheduleBlocks] = useState([]);
  const [scheduleSettings, setScheduleSettings] = useState({ startTime: '07:00', endTime: '22:00' });
  const [quickCaptures, setQuickCaptures] = useState([]);
  const [todos, setTodos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Demo mode helpers
  const saveDemoDeadlines = useCallback((data) => {
    setDeadlines(data);
    sessionStorage.setItem('demo-deadlines', JSON.stringify(data));
  }, []);

  const saveDemoScheduleBlocks = useCallback((data) => {
    setScheduleBlocks(data);
    sessionStorage.setItem('demo-scheduleBlocks', JSON.stringify(data));
  }, []);

  const saveDemoQuickCaptures = useCallback((data) => {
    setQuickCaptures(data);
    sessionStorage.setItem('demo-quickCaptures', JSON.stringify(data));
  }, []);

  const saveDemoTodos = useCallback((data) => {
    setTodos(data);
    sessionStorage.setItem('demo-todos', JSON.stringify(data));
  }, []);

  // Load dashboard layout and demo data
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Demo mode: load from sessionStorage or use defaults
    if (isDemo) {
      const savedDeadlines = sessionStorage.getItem('demo-deadlines');
      const savedBlocks = sessionStorage.getItem('demo-scheduleBlocks');
      const savedCaptures = sessionStorage.getItem('demo-quickCaptures');
      const savedTodos = sessionStorage.getItem('demo-todos');

      setDeadlines(savedDeadlines ? JSON.parse(savedDeadlines) : DEMO_DEADLINES);
      setScheduleBlocks(savedBlocks ? JSON.parse(savedBlocks) : DEMO_SCHEDULE_BLOCKS);
      setQuickCaptures(savedCaptures ? JSON.parse(savedCaptures) : DEMO_QUICK_CAPTURES);
      setTodos(savedTodos ? JSON.parse(savedTodos) : DEMO_TODOS);

      if (!savedDeadlines) sessionStorage.setItem('demo-deadlines', JSON.stringify(DEMO_DEADLINES));
      if (!savedBlocks) sessionStorage.setItem('demo-scheduleBlocks', JSON.stringify(DEMO_SCHEDULE_BLOCKS));
      if (!savedCaptures) sessionStorage.setItem('demo-quickCaptures', JSON.stringify(DEMO_QUICK_CAPTURES));
      if (!savedTodos) sessionStorage.setItem('demo-todos', JSON.stringify(DEMO_TODOS));

      setIsLoading(false);
      return;
    }

    const loadDashboard = async () => {
      try {
        const dashboardRef = doc(db, 'users', user.uid, 'dashboard', 'config');
        const dashboardSnap = await getDoc(dashboardRef);

        if (dashboardSnap.exists()) {
          const data = dashboardSnap.data();
          if (data.layout) setLayout(data.layout);
          if (data.activeWidgets) setActiveWidgets(data.activeWidgets);
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
      }
    };

    loadDashboard();
  }, [user, isDemo]);

  // Subscribe to deadlines
  useEffect(() => {
    if (!user || isDemo) return;

    const deadlinesRef = collection(db, 'users', user.uid, 'deadlines');
    const q = query(deadlinesRef, orderBy('date', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deadlinesList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDeadlines(deadlinesList);
    });

    return () => unsubscribe();
  }, [user, isDemo]);

  // Subscribe to schedule blocks
  useEffect(() => {
    if (!user || isDemo) return;

    const blocksRef = collection(db, 'users', user.uid, 'scheduleBlocks');
    const q = query(blocksRef, orderBy('startTime', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const blocksList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setScheduleBlocks(blocksList);
    });

    return () => unsubscribe();
  }, [user, isDemo]);

  // Subscribe to quick captures
  useEffect(() => {
    if (!user || isDemo) {
      if (!user) setIsLoading(false);
      return;
    }

    const capturesRef = collection(db, 'users', user.uid, 'quickCaptures');
    const q = query(capturesRef, orderBy('createdAt', 'desc'), limit(10));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const capturesList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setQuickCaptures(capturesList);
      setIsLoading(false);
    }, (error) => {
      console.error('Error subscribing to quick captures:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, isDemo]);

  // Subscribe to dashboard todos
  useEffect(() => {
    if (!user || isDemo) return;

    const todosRef = collection(db, 'users', user.uid, 'dashboardTodos');
    const q = query(todosRef, orderBy('order', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todosList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTodos(todosList);
    }, (error) => {
      console.error('Error subscribing to dashboard todos:', error);
    });

    return () => unsubscribe();
  }, [user, isDemo]);

  // Set loading to false after initial load attempt
  useEffect(() => {
    if (!user || isDemo) {
      setIsLoading(false);
      return;
    }

    // Timeout fallback in case subscriptions don't fire
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [user, isDemo]);

  // Save dashboard layout
  const saveLayout = useCallback(async (newLayout, newActiveWidgets) => {
    if (!user) return;

    try {
      // Sanitize layout to remove undefined values (Firebase doesn't accept them)
      const cleanLayout = newLayout.map(item => {
        const clean = {};
        Object.keys(item).forEach(key => {
          if (item[key] !== undefined) {
            clean[key] = item[key];
          }
        });
        return clean;
      });

      const dashboardRef = doc(db, 'users', user.uid, 'dashboard', 'config');
      await setDoc(dashboardRef, {
        layout: cleanLayout,
        activeWidgets: newActiveWidgets,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setLayout(cleanLayout);
      setActiveWidgets(newActiveWidgets);
    } catch (error) {
      console.error('Error saving dashboard layout:', error);
    }
  }, [user]);

  // Deadline operations
  const addDeadline = useCallback(async (deadline) => {
    if (!user) return;

    if (isDemo) {
      const newDeadline = { id: `demo-deadline-${Date.now()}`, ...deadline };
      saveDemoDeadlines([...deadlines, newDeadline]);
      return;
    }

    try {
      const deadlinesRef = collection(db, 'users', user.uid, 'deadlines');
      await addDoc(deadlinesRef, deadline);
    } catch (error) {
      console.error('Error adding deadline:', error);
    }
  }, [user, isDemo, deadlines, saveDemoDeadlines]);

  const updateDeadline = useCallback(async (id, updates) => {
    if (!user) return;

    if (isDemo) {
      saveDemoDeadlines(deadlines.map(d => d.id === id ? { ...d, ...updates } : d));
      return;
    }

    try {
      const deadlineRef = doc(db, 'users', user.uid, 'deadlines', id);
      await updateDoc(deadlineRef, updates);
    } catch (error) {
      console.error('Error updating deadline:', error);
    }
  }, [user, isDemo, deadlines, saveDemoDeadlines]);

  const deleteDeadline = useCallback(async (id) => {
    if (!user) return;

    if (isDemo) {
      saveDemoDeadlines(deadlines.filter(d => d.id !== id));
      return;
    }

    try {
      const deadlineRef = doc(db, 'users', user.uid, 'deadlines', id);
      await deleteDoc(deadlineRef);
    } catch (error) {
      console.error('Error deleting deadline:', error);
    }
  }, [user, isDemo, deadlines, saveDemoDeadlines]);

  // Schedule block operations
  const addScheduleBlock = useCallback(async (block) => {
    if (!user) return;

    if (isDemo) {
      const newBlock = { id: `demo-block-${Date.now()}`, ...block };
      saveDemoScheduleBlocks([...scheduleBlocks, newBlock]);
      return;
    }

    try {
      const blocksRef = collection(db, 'users', user.uid, 'scheduleBlocks');
      await addDoc(blocksRef, block);
    } catch (error) {
      console.error('Error adding schedule block:', error);
    }
  }, [user, isDemo, scheduleBlocks, saveDemoScheduleBlocks]);

  const updateScheduleBlock = useCallback(async (id, updates) => {
    if (!user) return;

    if (isDemo) {
      saveDemoScheduleBlocks(scheduleBlocks.map(b => b.id === id ? { ...b, ...updates } : b));
      return;
    }

    try {
      const blockRef = doc(db, 'users', user.uid, 'scheduleBlocks', id);
      await updateDoc(blockRef, updates);
    } catch (error) {
      console.error('Error updating schedule block:', error);
    }
  }, [user, isDemo, scheduleBlocks, saveDemoScheduleBlocks]);

  const deleteScheduleBlock = useCallback(async (id) => {
    if (!user) return;

    if (isDemo) {
      saveDemoScheduleBlocks(scheduleBlocks.filter(b => b.id !== id));
      return;
    }

    try {
      const blockRef = doc(db, 'users', user.uid, 'scheduleBlocks', id);
      await deleteDoc(blockRef);
    } catch (error) {
      console.error('Error deleting schedule block:', error);
    }
  }, [user, isDemo, scheduleBlocks, saveDemoScheduleBlocks]);

  // Quick capture operations
  const addQuickCapture = useCallback(async (capture) => {
    if (!user) return;

    if (isDemo) {
      const newCapture = { id: `demo-capture-${Date.now()}`, ...capture };
      saveDemoQuickCaptures([newCapture, ...quickCaptures]);
      return;
    }

    try {
      const capturesRef = collection(db, 'users', user.uid, 'quickCaptures');
      await addDoc(capturesRef, capture);
    } catch (error) {
      console.error('Error adding quick capture:', error);
    }
  }, [user, isDemo, quickCaptures, saveDemoQuickCaptures]);

  const updateQuickCapture = useCallback(async (id, updates) => {
    if (!user) return;

    if (isDemo) {
      saveDemoQuickCaptures(quickCaptures.map(c => c.id === id ? { ...c, ...updates } : c));
      return;
    }

    try {
      const captureRef = doc(db, 'users', user.uid, 'quickCaptures', id);
      await updateDoc(captureRef, updates);
    } catch (error) {
      console.error('Error updating quick capture:', error);
    }
  }, [user, isDemo, quickCaptures, saveDemoQuickCaptures]);

  const deleteQuickCapture = useCallback(async (id) => {
    if (!user) return;

    if (isDemo) {
      saveDemoQuickCaptures(quickCaptures.filter(c => c.id !== id));
      return;
    }

    try {
      const captureRef = doc(db, 'users', user.uid, 'quickCaptures', id);
      await deleteDoc(captureRef);
    } catch (error) {
      console.error('Error deleting quick capture:', error);
    }
  }, [user, isDemo, quickCaptures, saveDemoQuickCaptures]);

  // Dashboard todo operations
  const addTodo = useCallback(async (todo) => {
    if (!user) return;

    if (isDemo) {
      const newTodo = {
        id: `demo-todo-${Date.now()}`,
        ...todo,
        completed: false,
        order: todos.length,
        createdAt: new Date().toISOString(),
      };
      saveDemoTodos([...todos, newTodo]);
      return;
    }

    try {
      const todosRef = collection(db, 'users', user.uid, 'dashboardTodos');
      await addDoc(todosRef, {
        ...todo,
        completed: false,
        order: todos.length,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error adding todo:', error);
    }
  }, [user, isDemo, todos, saveDemoTodos]);

  const updateTodo = useCallback(async (id, updates) => {
    if (!user) return;

    if (isDemo) {
      saveDemoTodos(todos.map(t => t.id === id ? { ...t, ...updates } : t));
      return;
    }

    try {
      const todoRef = doc(db, 'users', user.uid, 'dashboardTodos', id);
      await updateDoc(todoRef, updates);
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  }, [user, isDemo, todos, saveDemoTodos]);

  const deleteTodo = useCallback(async (id) => {
    if (!user) return;

    if (isDemo) {
      saveDemoTodos(todos.filter(t => t.id !== id));
      return;
    }

    try {
      const todoRef = doc(db, 'users', user.uid, 'dashboardTodos', id);
      await deleteDoc(todoRef);
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  }, [user, isDemo, todos, saveDemoTodos]);

  const toggleTodo = useCallback(async (id) => {
    const todo = todos.find(t => t.id === id);
    if (todo) {
      await updateTodo(id, { completed: !todo.completed });
    }
  }, [todos, updateTodo]);

  return {
    // State
    layout,
    activeWidgets,
    deadlines,
    scheduleBlocks,
    scheduleSettings,
    quickCaptures,
    todos,
    isLoading,

    // Actions
    saveLayout,
    addDeadline,
    updateDeadline,
    deleteDeadline,
    addScheduleBlock,
    updateScheduleBlock,
    deleteScheduleBlock,
    addQuickCapture,
    updateQuickCapture,
    deleteQuickCapture,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
  };
}
