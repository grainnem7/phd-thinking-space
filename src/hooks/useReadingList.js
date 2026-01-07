import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from './useAuth';

export function useReadingList() {
  const { user } = useAuth();
  const [papers, setPapers] = useState([]);
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to papers
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const papersRef = collection(db, 'users', user.uid, 'papers');
    const q = query(papersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const papersList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPapers(papersList);
      setIsLoading(false);
    }, (error) => {
      console.error('Error subscribing to papers:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Subscribe to tags
  useEffect(() => {
    if (!user) return;

    const tagsRef = collection(db, 'users', user.uid, 'paperTags');
    const q = query(tagsRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tagsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTags(tagsList);
    }, (error) => {
      console.error('Error subscribing to tags:', error);
    });

    return () => unsubscribe();
  }, [user]);

  // Add paper
  const addPaper = useCallback(async (paperData) => {
    if (!user) return null;

    try {
      const papersRef = collection(db, 'users', user.uid, 'papers');
      const docRef = await addDoc(papersRef, {
        ...paperData,
        status: paperData.status || 'to-read',
        priority: paperData.priority || null,
        tags: paperData.tags || [],
        notes: paperData.notes || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding paper:', error);
      return null;
    }
  }, [user]);

  // Update paper
  const updatePaper = useCallback(async (paperId, updates) => {
    if (!user) return;

    try {
      const paperRef = doc(db, 'users', user.uid, 'papers', paperId);
      await updateDoc(paperRef, {
        ...updates,
        updatedAt: serverTimestamp(),
        // Set readAt when status changes to 'read'
        ...(updates.status === 'read' ? { readAt: serverTimestamp() } : {}),
      });
    } catch (error) {
      console.error('Error updating paper:', error);
    }
  }, [user]);

  // Delete paper (and associated file if exists)
  const deletePaper = useCallback(async (paperId) => {
    if (!user) return;

    try {
      const paperRef = doc(db, 'users', user.uid, 'papers', paperId);

      // Get the paper to check for attached file
      const paperSnap = await getDoc(paperRef);
      if (paperSnap.exists()) {
        const paperData = paperSnap.data();

        // Delete the file from storage if it exists
        if (paperData.file?.path) {
          try {
            const fileRef = ref(storage, paperData.file.path);
            await deleteObject(fileRef);
          } catch (fileError) {
            // File might not exist, continue with paper deletion
            console.warn('Could not delete file:', fileError);
          }
        }
      }

      await deleteDoc(paperRef);
    } catch (error) {
      console.error('Error deleting paper:', error);
    }
  }, [user]);

  // Add tag
  const addTag = useCallback(async (tagName) => {
    if (!user) return null;

    // Check if tag already exists
    const existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (existingTag) return existingTag.id;

    try {
      const tagsRef = collection(db, 'users', user.uid, 'paperTags');
      const docRef = await addDoc(tagsRef, {
        name: tagName,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding tag:', error);
      return null;
    }
  }, [user, tags]);

  // Delete tag
  const deleteTag = useCallback(async (tagId) => {
    if (!user) return;

    try {
      const tagRef = doc(db, 'users', user.uid, 'paperTags', tagId);
      await deleteDoc(tagRef);
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  }, [user]);

  // Get papers by status
  const getPapersByStatus = useCallback((status) => {
    if (status === 'all') return papers;
    return papers.filter(p => p.status === status);
  }, [papers]);

  // Get papers by tag
  const getPapersByTag = useCallback((tagName) => {
    return papers.filter(p => p.tags?.includes(tagName));
  }, [papers]);

  // Get counts by status
  const getCounts = useCallback(() => {
    return {
      'to-read': papers.filter(p => p.status === 'to-read').length,
      'reading': papers.filter(p => p.status === 'reading').length,
      'read': papers.filter(p => p.status === 'read').length,
      'archived': papers.filter(p => p.status === 'archived').length,
      'all': papers.length,
    };
  }, [papers]);

  return {
    papers,
    tags,
    isLoading,
    addPaper,
    updatePaper,
    deletePaper,
    addTag,
    deleteTag,
    getPapersByStatus,
    getPapersByTag,
    getCounts,
  };
}
