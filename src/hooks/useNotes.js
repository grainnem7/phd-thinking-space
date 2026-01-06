import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export function useNotes(noteId) {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimeoutRef = useRef(null);

  const saveContent = useCallback(async (content) => {
    if (!user || !noteId) return;

    setIsSaving(true);
    try {
      const noteRef = doc(db, 'users', user.uid, 'sections', noteId);
      await updateDoc(noteRef, {
        content,
        updatedAt: serverTimestamp(),
      });
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  }, [user, noteId]);

  const debouncedSave = useCallback((content) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveContent(content);
    }, 2000);
  }, [saveContent]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    isSaving,
    lastSaved,
    saveContent,
    debouncedSave,
  };
}
