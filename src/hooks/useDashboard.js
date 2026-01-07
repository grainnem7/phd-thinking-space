import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export function useDashboard() {
  const { user } = useAuth();
  const [layout, setLayout] = useState(null);
  const [activeWidgets, setActiveWidgets] = useState(['schedule', 'deadlines', 'taskSummary', 'quickCapture', 'recentNotes']);
  const [deadlines, setDeadlines] = useState([]);
  const [scheduleBlocks, setScheduleBlocks] = useState([]);
  const [scheduleSettings, setScheduleSettings] = useState({ startTime: '07:00', endTime: '22:00' });
  const [quickCaptures, setQuickCaptures] = useState([]);
  const [todos, setTodos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load dashboard layout
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  // Subscribe to deadlines
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  // Subscribe to schedule blocks
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  // Subscribe to quick captures
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
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
  }, [user]);

  // Subscribe to dashboard todos
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  // Set loading to false after initial load attempt
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Timeout fallback in case subscriptions don't fire
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [user]);

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

    try {
      const deadlinesRef = collection(db, 'users', user.uid, 'deadlines');
      await addDoc(deadlinesRef, deadline);
    } catch (error) {
      console.error('Error adding deadline:', error);
    }
  }, [user]);

  const updateDeadline = useCallback(async (id, updates) => {
    if (!user) return;

    try {
      const deadlineRef = doc(db, 'users', user.uid, 'deadlines', id);
      await updateDoc(deadlineRef, updates);
    } catch (error) {
      console.error('Error updating deadline:', error);
    }
  }, [user]);

  const deleteDeadline = useCallback(async (id) => {
    if (!user) return;

    try {
      const deadlineRef = doc(db, 'users', user.uid, 'deadlines', id);
      await deleteDoc(deadlineRef);
    } catch (error) {
      console.error('Error deleting deadline:', error);
    }
  }, [user]);

  // Schedule block operations
  const addScheduleBlock = useCallback(async (block) => {
    if (!user) return;

    try {
      const blocksRef = collection(db, 'users', user.uid, 'scheduleBlocks');
      await addDoc(blocksRef, block);
    } catch (error) {
      console.error('Error adding schedule block:', error);
    }
  }, [user]);

  const updateScheduleBlock = useCallback(async (id, updates) => {
    if (!user) return;

    try {
      const blockRef = doc(db, 'users', user.uid, 'scheduleBlocks', id);
      await updateDoc(blockRef, updates);
    } catch (error) {
      console.error('Error updating schedule block:', error);
    }
  }, [user]);

  const deleteScheduleBlock = useCallback(async (id) => {
    if (!user) return;

    try {
      const blockRef = doc(db, 'users', user.uid, 'scheduleBlocks', id);
      await deleteDoc(blockRef);
    } catch (error) {
      console.error('Error deleting schedule block:', error);
    }
  }, [user]);

  // Quick capture operations
  const addQuickCapture = useCallback(async (capture) => {
    if (!user) return;

    try {
      const capturesRef = collection(db, 'users', user.uid, 'quickCaptures');
      await addDoc(capturesRef, capture);
    } catch (error) {
      console.error('Error adding quick capture:', error);
    }
  }, [user]);

  // Dashboard todo operations
  const addTodo = useCallback(async (todo) => {
    if (!user) return;

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
  }, [user, todos.length]);

  const updateTodo = useCallback(async (id, updates) => {
    if (!user) return;

    try {
      const todoRef = doc(db, 'users', user.uid, 'dashboardTodos', id);
      await updateDoc(todoRef, updates);
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  }, [user]);

  const deleteTodo = useCallback(async (id) => {
    if (!user) return;

    try {
      const todoRef = doc(db, 'users', user.uid, 'dashboardTodos', id);
      await deleteDoc(todoRef);
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  }, [user]);

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
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
  };
}
