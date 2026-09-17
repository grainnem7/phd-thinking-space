import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  getAppearance,
  hasLocalAppearance,
  normalizeAppearance,
  setAppearance,
  subscribeAppearance,
} from './appearance';

const WRITE_DELAY = 800;

const appearanceRef = (uid) => doc(db, 'users', uid, 'settings', 'appearance');

// Syncs appearance with Firestore users/{uid}/settings/appearance for signed-in
// accounts. Demo mode never has a Firebase user, so it stays local-only.
//  - After sign-in: adopt the account's saved appearance if this device has no
//    choice of its own; seed the account from this device if it has none yet.
//  - Changes made on this device are written back (debounced).
// Started once by ThemeProvider; returns a cleanup function.
export function startAppearanceSync() {
  let uid = null;
  let timer = null;

  const scheduleWrite = () => {
    clearTimeout(timer);
    const target = uid;
    if (!target) return;
    timer = setTimeout(() => {
      setDoc(appearanceRef(target), { ...getAppearance(), updatedAt: serverTimestamp() }, { merge: true })
        .catch((e) => console.warn('Could not save appearance settings:', e));
    }, WRITE_DELAY);
  };

  const unsubscribeStore = subscribeAppearance((source) => {
    if (source === 'local') scheduleWrite();
  });

  const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    clearTimeout(timer);
    uid = user?.uid ?? null;
    if (!user) return;

    try {
      const snap = await getDoc(appearanceRef(user.uid));
      if (uid !== user.uid) return; // signed out or switched account meanwhile
      if (snap.exists()) {
        if (!hasLocalAppearance()) {
          setAppearance(normalizeAppearance(snap.data()), { source: 'remote' });
        }
      } else if (hasLocalAppearance()) {
        scheduleWrite();
      }
    } catch (e) {
      // Offline with nothing cached, or rules denied: keep the local settings
      console.warn('Could not load appearance settings:', e);
    }
  });

  return () => {
    clearTimeout(timer);
    unsubscribeStore();
    unsubscribeAuth();
  };
}
