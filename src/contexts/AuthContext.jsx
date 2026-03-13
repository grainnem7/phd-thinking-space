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

  const createUserProfile = async (user) => {
    const profileRef = doc(db, 'users', user.uid, 'profile', 'info');
    const profileSnap = await getDoc(profileRef);
    
    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        displayName: user.displayName || 'User',
        email: user.email,
        createdAt: serverTimestamp(),
      });
      
      // Create default sections
      await createDefaultSections(user.uid);
    }
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

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    await createUserProfile(result.user);
    return result.user;
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
