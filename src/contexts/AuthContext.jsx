import { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Demo user constant
const DEMO_USER = {
  uid: 'demo-user',
  email: 'demo@example.com',
  displayName: 'Demo User',
  photoURL: null,
  isDemo: true,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    // Check for existing demo session
    const demoSession = sessionStorage.getItem('demo-mode');
    if (demoSession === 'true') {
      setUser(DEMO_USER);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid, 'profile', 'info'));
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || userDoc.data()?.displayName || 'User',
          photoURL: firebaseUser.photoURL,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const createUserProfile = async (user, { skipDefaults = false } = {}) => {
    const profileRef = doc(db, 'users', user.uid, 'profile', 'info');
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        displayName: user.displayName || 'User',
        email: user.email,
        createdAt: serverTimestamp(),
      });

      if (!skipDefaults) {
        await createDefaultSections(user.uid);
      }
    }

    return !profileSnap.exists();
  };

  const createDefaultSections = async (userId) => {
    const { collection, addDoc } = await import('firebase/firestore');
    const sectionsRef = collection(db, 'users', userId, 'sections');

    // Create minimal, useful defaults
    const defaultSections = [
      {
        name: 'Notes',
        icon: 'folder',
        order: 0,
        parentId: null,
        type: 'folder'
      },
      {
        name: 'Tasks',
        icon: 'kanban',
        order: 1,
        parentId: null,
        type: 'board',
        columns: [
          { id: 'todo', name: 'To Do', order: 0 },
          { id: 'in-progress', name: 'In Progress', order: 1 },
          { id: 'done', name: 'Done', order: 2 },
        ],
        tasks: [],
      },
    ];

    for (const section of defaultSections) {
      await addDoc(sectionsRef, {
        ...section,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  const signInWithGoogle = async ({ skipDefaults = false } = {}) => {
    const result = await signInWithPopup(auth, googleProvider);
    const isNewUser = await createUserProfile(result.user, { skipDefaults });
    return { user: result.user, isNewUser };
  };

  // Demo storage keys → Firestore subcollection names
  const DEMO_MIGRATION_MAP = {
    'demo-sections': 'sections',
    'demo-deadlines': 'deadlines',
    'demo-scheduleBlocks': 'scheduleBlocks',
    'demo-quickCaptures': 'quickCaptures',
    'demo-todos': 'dashboardTodos',
    'demo-papers': 'papers',
    'demo-collections': 'paperCollections',
  };

  const hasDemoData = () =>
    Object.keys(DEMO_MIGRATION_MAP).some((k) => sessionStorage.getItem(k));

  const clearDemoData = () => {
    Object.keys(DEMO_MIGRATION_MAP).forEach((k) => sessionStorage.removeItem(k));
    sessionStorage.removeItem('demo-mode');
  };

  const migrateDemoData = async (userId) => {
    const { collection, addDoc } = await import('firebase/firestore');
    let migratedCount = 0;
    for (const [storageKey, firestoreCollection] of Object.entries(DEMO_MIGRATION_MAP)) {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) continue;
      try {
        const items = JSON.parse(raw);
        if (!Array.isArray(items)) continue;
        const collRef = collection(db, 'users', userId, firestoreCollection);
        for (const item of items) {
          // Strip the demo-prefixed local id; let Firestore assign a new one
          const { id: _ignored, ...rest } = item;
          await addDoc(collRef, {
            ...rest,
            createdAt: rest.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          migratedCount += 1;
        }
      } catch (e) {
        console.error(`Failed to migrate ${storageKey}:`, e);
      }
    }
    clearDemoData();
    return migratedCount;
  };

  const enterDemoMode = () => {
    sessionStorage.setItem('demo-mode', 'true');
    setUser(DEMO_USER);
    setIsDemo(true);
  };

  const exitDemoMode = () => {
    sessionStorage.removeItem('demo-mode');
    setUser(null);
    setIsDemo(false);
  };

  const logout = async () => {
    if (isDemo) {
      exitDemoMode();
    } else {
      await signOut(auth);
    }
  };

  const value = {
    user,
    loading,
    isDemo,
    signInWithGoogle,
    enterDemoMode,
    exitDemoMode,
    logout,
    hasDemoData,
    migrateDemoData,
    clearDemoData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
