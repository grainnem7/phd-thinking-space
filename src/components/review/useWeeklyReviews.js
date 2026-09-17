import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useDemoValue, readDemoValue, writeDemoValue } from '../../hooks/useWritingStats';

// Weekly reflections:
//   users/{uid}/weeklyReviews/{YYYY-MM-DD of Monday} -> { weekStart, wentWell, hard, focus, updatedAt }
// Demo mode: sessionStorage 'demo-weeklyReviews' (array of the same, with id = weekStart).
// Reviews are matched on `weekStart`, so copies with other document ids still load.

const DEMO_KEY = 'demo-weeklyReviews';
const EMPTY = [];

export function useWeeklyReviews() {
  const { user, isDemo } = useAuth();
  const uid = user?.uid ?? null;
  const live = Boolean(uid) && !isDemo;
  const [remote, setRemote] = useState({ uid: null, items: EMPTY });

  useEffect(() => {
    if (!live) return undefined;
    return onSnapshot(collection(db, 'users', uid, 'weeklyReviews'), (snap) => {
      setRemote({ uid, items: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
    }, (error) => {
      console.error('Error loading weekly reviews:', error);
      setRemote({ uid, items: EMPTY });
    });
  }, [live, uid]);

  const demoItems = useDemoValue(DEMO_KEY, EMPTY, isDemo);

  let reviews = EMPTY;
  let loaded = true;
  if (uid && isDemo) {
    reviews = Array.isArray(demoItems) ? demoItems : EMPTY;
  } else if (live) {
    loaded = remote.uid === uid;
    reviews = loaded ? remote.items : EMPTY;
  }

  const saveReview = useCallback(async (weekStart, fields) => {
    if (!uid) return;
    if (isDemo) {
      const stored = readDemoValue(DEMO_KEY, EMPTY);
      const items = Array.isArray(stored) ? stored : EMPTY;
      const entry = { ...fields, id: weekStart, weekStart, updatedAt: new Date().toISOString() };
      const exists = items.some((r) => r.weekStart === weekStart);
      writeDemoValue(DEMO_KEY, exists
        ? items.map((r) => (r.weekStart === weekStart ? { ...r, ...entry } : r))
        : [...items, entry]);
      return;
    }
    await setDoc(
      doc(db, 'users', uid, 'weeklyReviews', weekStart),
      { ...fields, weekStart, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }, [uid, isDemo]);

  return { reviews, loaded, saveReview };
}
