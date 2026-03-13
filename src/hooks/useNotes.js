import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export function useNotes(noteId, saveSection) {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);
  const saveTimeoutRef = useRef(null);
  const pendingContentRef = useRef(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const saveContent = useCallback(async (content) => {
    if (!noteId) return;

    // Remember the last content that we attempted to save
    pendingContentRef.current = content;

    if (!user && !saveSection) return;

    const shouldUpdateState = isMountedRef.current;
    if (shouldUpdateState) {
      setIsSaving(true);
      setError(null);
    }

    try {
      if (saveSection) {
        await saveSection(noteId, { content });
      } else {
        const noteRef = doc(db, 'users', user.uid, 'sections', noteId);
        await setDoc(noteRef, {
          content,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      if (shouldUpdateState) {
        setLastSaved(new Date());
        setError(null);
      }
    } catch (error) {
      console.error('Error saving note:', error);
      if (shouldUpdateState) setError(error?.message || 'Failed to save');
    } finally {
      if (shouldUpdateState) setIsSaving(false);
    }
  }, [user, noteId, saveSection]);

  const debouncedSave = useCallback((content) => {
    pendingContentRef.current = content;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveContent(content);
    }, 2000);
  }, [saveContent]);

  // Flush pending save when switching notes or unmounting
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        if (pendingContentRef.current) {
          saveContent(pendingContentRef.current);
          pendingContentRef.current = null;
        }
      }
    };
  }, [saveContent, noteId]);

  return {
    isSaving,
    lastSaved,
    error,
    saveContent,
    debouncedSave,
  };
}
