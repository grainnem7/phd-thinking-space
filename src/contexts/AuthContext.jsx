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
    
    const defaultSections = [
      { name: 'App Design & Development', icon: 'code', order: 0, parentId: null, type: 'folder' },
      { name: 'Writing', icon: 'pen-tool', order: 1, parentId: null, type: 'folder' },
      { name: 'Task Boards', icon: 'layout', order: 2, parentId: null, type: 'folder' },
      { name: 'Quick Ideas', icon: 'lightbulb', order: 3, parentId: null, type: 'note', content: '# Quick Ideas\n\nCapture your fleeting thoughts here...' },
      { name: 'Research Journal', icon: 'book-open', order: 4, parentId: null, type: 'note', content: '# Research Journal\n\n## Weekly Reflections\n\nUse this space for your weekly research reflections...' },
    ];

    const createdSections = {};
    
    for (const section of defaultSections) {
      const docRef = await addDoc(sectionsRef, {
        ...section,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      createdSections[section.name] = docRef.id;
    }

    // Create Writing subsections
    const writingSubsections = [
      { name: 'Research Questions', icon: 'help-circle', order: 0, type: 'note', content: '# Research Questions\n\nDocument your research questions here...' },
      { name: 'Literature Review', icon: 'book', order: 1, type: 'note', content: '# Literature Review\n\nOrganize your literature review notes...' },
      { name: 'Methodology', icon: 'compass', order: 2, type: 'note', content: '# Methodology\n\nOutline your research methodology...' },
      { name: 'Draft Chapters', icon: 'file-text', order: 3, type: 'folder' },
    ];

    for (const subsection of writingSubsections) {
      await addDoc(sectionsRef, {
        ...subsection,
        parentId: createdSections['Writing'],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Create a sample Kanban board
    await addDoc(sectionsRef, {
      name: 'PhD Tasks',
      icon: 'kanban',
      order: 0,
      parentId: createdSections['Task Boards'],
      type: 'board',
      columns: [
        { id: 'backlog', name: 'Backlog', order: 0 },
        { id: 'in-progress', name: 'In Progress', order: 1 },
        { id: 'review', name: 'Review', order: 2 },
        { id: 'done', name: 'Done', order: 3 },
      ],
      tasks: [
        { id: '1', title: 'Review literature on topic A', columnId: 'backlog', priority: 'medium', tags: ['research'], order: 0 },
        { id: '2', title: 'Write introduction draft', columnId: 'in-progress', priority: 'high', tags: ['writing'], order: 0 },
        { id: '3', title: 'Submit ethics application', columnId: 'done', priority: 'high', tags: ['admin'], order: 0 },
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create a sample note in App Design folder
    await addDoc(sectionsRef, {
      name: 'Project Ideas',
      icon: 'file-text',
      order: 0,
      parentId: createdSections['App Design & Development'],
      type: 'note',
      content: '# Project Ideas\n\nDocument your app design and development ideas here...',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
