import { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, collection, setDoc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { defaultSections, BATCH_LIMIT } from '../lib/defaults';

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

// Demo storage keys → Firestore subcollection names
const DEMO_MIGRATION_MAP = {
  'demo-sections': 'sections',
  'demo-deadlines': 'deadlines',
  'demo-scheduleBlocks': 'scheduleBlocks',
  'demo-quickCaptures': 'quickCaptures',
  'demo-todos': 'dashboardTodos',
  'demo-papers': 'papers',
  'demo-collections': 'paperCollections',
  'demo-calendarItems': 'calendarItems',
  'demo-writingStats': 'writingStats',
  'demo-templates': 'templates',
  'demo-weeklyReviews': 'weeklyReviews',
};

// Collections whose document id is meaningful (a date / week start) and must be kept
const NATURAL_ID_FIELDS = {
  writingStats: 'date',
  weeklyReviews: 'weekStart',
};

// Demo keys holding a single settings document rather than a list
const DEMO_SINGLE_DOCS = {
  'demo-dashboardLayout': ['dashboard', 'config'],
  'demo-writingSettings': ['settings', 'writing'],
};

function readDemoObject(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function readDemoArray(key) {
  try {
    const items = JSON.parse(sessionStorage.getItem(key));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    // Always listen for Firebase auth, even when a demo session exists, so that
    // signing in after a reload in demo mode is picked up immediately.
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let profileName;
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid, 'profile', 'info'));
          profileName = userDoc.data()?.displayName;
        } catch (e) {
          // Offline with nothing cached, or rules denied: the profile is optional
          console.warn('Could not load profile:', e);
        }
        setIsDemo(false);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || profileName || 'User',
          photoURL: firebaseUser.photoURL,
        });
      } else if (sessionStorage.getItem('demo-mode') === 'true') {
        setIsDemo(true);
        setUser(DEMO_USER);
      } else {
        setIsDemo(false);
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const createDefaultSections = async (userId) => {
    const batch = writeBatch(db);
    const sectionsRef = collection(db, 'users', userId, 'sections');
    for (const section of defaultSections()) {
      batch.set(doc(sectionsRef), { ...section, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    await batch.commit();
  };

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

  const signInWithGoogle = async ({ skipDefaults = false } = {}) => {
    const result = await signInWithPopup(auth, googleProvider);
    const isNewUser = await createUserProfile(result.user, { skipDefaults });
    return { user: result.user, isNewUser };
  };

  const demoKeys = () => [...Object.keys(DEMO_MIGRATION_MAP), ...Object.keys(DEMO_SINGLE_DOCS)];

  const hasDemoData = () => demoKeys().some((k) => sessionStorage.getItem(k));

  const clearDemoData = () => {
    demoKeys().forEach((k) => sessionStorage.removeItem(k));
    sessionStorage.removeItem('demo-mode');
  };

  // Copy demo work into the signed-in account. Firestore assigns new ids, so
  // every cross-reference (folder parents, paper collections, calendar links)
  // is rewritten to the new ids before anything is written.
  const migrateDemoData = async (userId) => {
    const idMaps = {};
    const plans = Object.entries(DEMO_MIGRATION_MAP).map(([storageKey, collectionName]) => {
      const collRef = collection(db, 'users', userId, collectionName);
      const items = readDemoArray(storageKey);
      const naturalField = NATURAL_ID_FIELDS[collectionName];
      idMaps[collectionName] = new Map(items.map((item) => [
        item.id,
        naturalField && item[naturalField] ? String(item[naturalField]) : doc(collRef).id,
      ]));
      return { collectionName, collRef, items };
    });

    const remap = (collectionName, id) => idMaps[collectionName]?.get(id) ?? id;

    const writes = [];
    for (const { collectionName, collRef, items } of plans) {
      for (const item of items) {
        const { id, ...rest } = item;
        const data = { ...rest, createdAt: rest.createdAt || serverTimestamp(), updatedAt: serverTimestamp() };

        if (collectionName === 'sections' && data.parentId) {
          data.parentId = remap('sections', data.parentId);
        }
        if (collectionName === 'papers' && Array.isArray(data.collections)) {
          data.collections = data.collections.map((c) => remap('paperCollections', c));
        }
        if (collectionName === 'calendarItems' && Array.isArray(data.links)) {
          data.links = data.links.map((l) => ({
            ...l,
            id: remap(l.type === 'paper' ? 'papers' : 'sections', l.id),
          }));
        }
        // Firestore rejects undefined values
        Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

        writes.push({ ref: doc(collRef, idMaps[collectionName].get(id)), data });
      }
    }

    for (const [storageKey, path] of Object.entries(DEMO_SINGLE_DOCS)) {
      const value = readDemoObject(storageKey);
      if (!value) continue;
      const data = { ...value, updatedAt: serverTimestamp() };
      Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
      writes.push({ ref: doc(db, 'users', userId, ...path), data });
    }

    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      writes.slice(i, i + BATCH_LIMIT).forEach(({ ref, data }) => batch.set(ref, data));
      // If this throws, the demo data stays in sessionStorage so nothing is lost
      await batch.commit();
    }

    clearDemoData();
    return writes.length;
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
