import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

// User note templates: users/{uid}/templates
//   { name, description, content (BlockNote JSON string), createdAt }
// Demo mode keeps them in sessionStorage (migrated on sign-up).

const DEMO_KEY = 'demo-templates';
const EMPTY = [];

function readDemo() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DEMO_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function useTemplates() {
  const { user, isDemo } = useAuth();
  const uid = user?.uid ?? null;
  const [demoTemplates, setDemoTemplates] = useState(() => (isDemo ? readDemo() : EMPTY));
  const [remote, setRemote] = useState({ uid: null, items: EMPTY, error: null });

  useEffect(() => {
    if (!uid || isDemo) return undefined;
    const q = query(collection(db, 'users', uid, 'templates'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => setRemote({ uid, items: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })), error: null }),
      (error) => {
        console.error('Error loading templates:', error);
        setRemote((prev) => ({ uid, items: prev.uid === uid ? prev.items : EMPTY, error }));
      },
    );
  }, [uid, isDemo]);

  const updateDemo = useCallback((fn) => {
    setDemoTemplates((prev) => {
      const next = fn(prev);
      try {
        sessionStorage.setItem(DEMO_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Could not save templates:', e);
      }
      return next;
    });
  }, []);

  const addTemplate = useCallback(async ({ name, description = '', content }) => {
    if (!uid) throw new Error('Sign in to save templates.');
    const data = { name: name.trim() || 'Untitled template', description: description.trim(), content: content || '' };
    if (isDemo) {
      const id = `demo-template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      updateDemo((prev) => [{ id, ...data, createdAt: new Date().toISOString() }, ...prev]);
      return id;
    }
    const ref = await addDoc(collection(db, 'users', uid, 'templates'), { ...data, createdAt: serverTimestamp() });
    return ref.id;
  }, [uid, isDemo, updateDemo]);

  const deleteTemplate = useCallback(async (id) => {
    if (!uid) return;
    if (isDemo) {
      updateDemo((prev) => prev.filter((t) => t.id !== id));
      return;
    }
    await deleteDoc(doc(db, 'users', uid, 'templates', id));
  }, [uid, isDemo, updateDemo]);

  let templates = EMPTY;
  let isLoading = false;
  if (uid && isDemo) {
    templates = demoTemplates;
  } else if (uid) {
    templates = remote.uid === uid ? remote.items : EMPTY;
    isLoading = remote.uid !== uid;
  }

  return {
    templates,
    isLoading,
    error: remote.uid === uid ? remote.error : null,
    addTemplate,
    deleteTemplate,
  };
}
