import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export function useFirestore() {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSections([]);
      setLoading(false);
      return;
    }

    const sectionsRef = collection(db, 'users', user.uid, 'sections');
    const q = query(sectionsRef, orderBy('order', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sectionsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSections(sectionsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const addSection = useCallback(async (sectionData) => {
    if (!user) return;
    
    const sectionsRef = collection(db, 'users', user.uid, 'sections');
    const newSection = {
      ...sectionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(sectionsRef, newSection);
    return docRef.id;
  }, [user]);

  const updateSection = useCallback(async (sectionId, updates) => {
    if (!user) return;
    
    const sectionRef = doc(db, 'users', user.uid, 'sections', sectionId);
    await updateDoc(sectionRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }, [user]);

  const deleteSection = useCallback(async (sectionId) => {
    if (!user) return;
    
    // Delete all children first
    const children = sections.filter(s => s.parentId === sectionId);
    for (const child of children) {
      await deleteSection(child.id);
    }
    
    const sectionRef = doc(db, 'users', user.uid, 'sections', sectionId);
    await deleteDoc(sectionRef);
  }, [user, sections]);

  const duplicateSection = useCallback(async (sectionId) => {
    if (!user) return;
    
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const { id, createdAt, updatedAt, ...sectionData } = section;
    const newSection = {
      ...sectionData,
      name: `${section.name} (copy)`,
      order: section.order + 0.5,
    };
    
    return await addSection(newSection);
  }, [user, sections, addSection]);

  const reorderSections = useCallback(async (reorderedSections) => {
    if (!user) return;

    const updates = reorderedSections.map((section, index) => ({
      id: section.id,
      order: index,
    }));

    for (const update of updates) {
      const sectionRef = doc(db, 'users', user.uid, 'sections', update.id);
      await updateDoc(sectionRef, { order: update.order, updatedAt: serverTimestamp() });
    }
  }, [user]);

  const resetToDefaults = useCallback(async () => {
    if (!user) return;

    // Delete all existing sections
    const sectionsRef = collection(db, 'users', user.uid, 'sections');
    for (const section of sections) {
      const sectionRef = doc(db, 'users', user.uid, 'sections', section.id);
      await deleteDoc(sectionRef);
    }

    // Create default sections
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
  }, [user, sections]);

  return {
    sections,
    loading,
    addSection,
    updateSection,
    deleteSection,
    duplicateSection,
    reorderSections,
    resetToDefaults,
  };
}
