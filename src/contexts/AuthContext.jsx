import { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  const signInWithEmail = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  };

  const signUpWithEmail = async (email, password, displayName) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    await createUserProfile({ ...result.user, displayName });
    return result.user;
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
