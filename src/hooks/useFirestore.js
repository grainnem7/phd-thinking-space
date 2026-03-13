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

// Demo data for preview mode
const DEMO_SECTIONS = [
  {
    id: 'demo-notes',
    name: 'Research Notes',
    icon: 'folder',
    order: 0,
    parentId: null,
    type: 'folder',
  },
  {
    id: 'demo-note-1',
    name: 'Literature Review',
    icon: 'file',
    order: 0,
    parentId: 'demo-notes',
    type: 'note',
    content: '# Literature Review\n\nThis is an example note demonstrating the rich text editor.\n\n## Key Findings\n\n- Finding 1: Lorem ipsum dolor sit amet\n- Finding 2: Consectetur adipiscing elit\n- Finding 3: Sed do eiusmod tempor incididunt\n\n## Next Steps\n\n1. Review additional papers\n2. Synthesize findings\n3. Draft methodology section',
  },
  {
    id: 'demo-note-2',
    name: 'Meeting Notes',
    icon: 'file',
    order: 1,
    parentId: 'demo-notes',
    type: 'note',
    content: '# Meeting Notes - Jan 2025\n\n**Attendees:** Dr. Smith, Dr. Johnson, Research Team\n\n## Discussion Points\n\n- Project timeline review\n- Budget allocation for Q1\n- New collaboration opportunities\n\n## Action Items\n\n- [ ] Submit grant proposal by Feb 15\n- [ ] Schedule follow-up meeting\n- [ ] Review draft chapters',
  },
  {
    id: 'demo-tasks',
    name: 'PhD Tasks',
    icon: 'kanban',
    order: 1,
    parentId: null,
    type: 'board',
    columns: [
      { id: 'todo', name: 'To Do', order: 0 },
      { id: 'in-progress', name: 'In Progress', order: 1 },
      { id: 'done', name: 'Done', order: 2 },
    ],
    tasks: [
      { id: 'task-1', title: 'Write Chapter 3 draft', columnId: 'in-progress', order: 0, description: 'Complete first draft of methodology chapter' },
      { id: 'task-2', title: 'Submit IRB application', columnId: 'todo', order: 0, description: 'Prepare and submit ethics approval' },
      { id: 'task-3', title: 'Literature search', columnId: 'done', order: 0, description: 'Complete systematic review search' },
      { id: 'task-4', title: 'Advisor meeting prep', columnId: 'todo', order: 1, description: 'Prepare slides for next meeting' },
      { id: 'task-5', title: 'Data collection plan', columnId: 'in-progress', order: 1, description: 'Finalize participant recruitment strategy' },
    ],
  },
  {
    id: 'demo-ideas',
    name: 'Research Ideas',
    icon: 'file',
    order: 2,
    parentId: null,
    type: 'note',
    content: '# Research Ideas\n\n## Potential Topics\n\n1. **Machine Learning in Education**\n   - Personalized learning paths\n   - Automated assessment\n\n2. **Human-Computer Interaction**\n   - Accessibility improvements\n   - User experience research\n\n## Questions to Explore\n\n- How can AI improve student outcomes?\n- What are the ethical implications?\n- How do we measure success?',
  },
];

export function useFirestore() {
  const { user, isDemo } = useAuth();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSections([]);
      setLoading(false);
      return;
    }

    // Demo mode: use local state
    if (isDemo) {
      // Check for existing demo data in sessionStorage
      const savedDemoData = sessionStorage.getItem('demo-sections');
      if (savedDemoData) {
        setSections(JSON.parse(savedDemoData));
      } else {
        setSections(DEMO_SECTIONS);
        sessionStorage.setItem('demo-sections', JSON.stringify(DEMO_SECTIONS));
      }
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
  }, [user, isDemo]);

  // Helper to save demo data
  const saveDemoData = useCallback((newSections) => {
    setSections(newSections);
    sessionStorage.setItem('demo-sections', JSON.stringify(newSections));
  }, []);

  const addSection = useCallback(async (sectionData) => {
    if (!user) return;

    // Demo mode: local state
    if (isDemo) {
      const newId = `demo-${Date.now()}`;
      const newSection = {
        id: newId,
        ...sectionData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const newSections = [...sections, newSection];
      saveDemoData(newSections);
      return newId;
    }

    const sectionsRef = collection(db, 'users', user.uid, 'sections');
    const newSection = {
      ...sectionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(sectionsRef, newSection);
    return docRef.id;
  }, [user, isDemo, sections, saveDemoData]);

  const updateSection = useCallback(async (sectionId, updates) => {
    if (!user) return;

    // Demo mode: local state
    if (isDemo) {
      const newSections = sections.map(s =>
        s.id === sectionId
          ? { ...s, ...updates, updatedAt: new Date().toISOString() }
          : s
      );
      saveDemoData(newSections);
      return;
    }

    const sectionRef = doc(db, 'users', user.uid, 'sections', sectionId);
    await updateDoc(sectionRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }, [user, isDemo, sections, saveDemoData]);

  const deleteSection = useCallback(async (sectionId) => {
    if (!user) return;

    // Demo mode: local state
    if (isDemo) {
      // Get all IDs to delete (including children recursively)
      const getChildIds = (parentId) => {
        const children = sections.filter(s => s.parentId === parentId);
        return children.flatMap(child => [child.id, ...getChildIds(child.id)]);
      };
      const idsToDelete = [sectionId, ...getChildIds(sectionId)];
      const newSections = sections.filter(s => !idsToDelete.includes(s.id));
      saveDemoData(newSections);
      return;
    }

    // Delete all children first
    const children = sections.filter(s => s.parentId === sectionId);
    for (const child of children) {
      await deleteSection(child.id);
    }

    const sectionRef = doc(db, 'users', user.uid, 'sections', sectionId);
    await deleteDoc(sectionRef);
  }, [user, isDemo, sections, saveDemoData]);

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

    // Demo mode: local state
    if (isDemo) {
      const updates = reorderedSections.map((section, index) => ({
        ...section,
        order: index,
        updatedAt: new Date().toISOString(),
      }));
      // Merge with other sections that weren't reordered
      const reorderedIds = new Set(reorderedSections.map(s => s.id));
      const otherSections = sections.filter(s => !reorderedIds.has(s.id));
      saveDemoData([...updates, ...otherSections]);
      return;
    }

    const updates = reorderedSections.map((section, index) => ({
      id: section.id,
      order: index,
    }));

    for (const update of updates) {
      const sectionRef = doc(db, 'users', user.uid, 'sections', update.id);
      await updateDoc(sectionRef, { order: update.order, updatedAt: serverTimestamp() });
    }
  }, [user, isDemo, sections, saveDemoData]);

  const resetToDefaults = useCallback(async () => {
    if (!user) return;

    // Demo mode: reset to demo defaults
    if (isDemo) {
      saveDemoData(DEMO_SECTIONS);
      return;
    }

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
  }, [user, isDemo, sections, saveDemoData]);

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
