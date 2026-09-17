import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const FocusModeContext = createContext(null);

// Older builds persisted focus mode, which could reopen the app with no chrome.
const LEGACY_STORAGE_KEY = 'note-focus-mode';

export function FocusModeProvider({ children }) {
  // Deliberately not persisted: every reload starts with the normal layout.
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => setFocusMode((v) => !v), []);
  const exit = useCallback(() => setFocusMode(false), []);

  // Cmd/Ctrl+Shift+F toggles, Esc exits (unless typing in an input/textarea)
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setFocusMode((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        // If user is typing, let their input handle Escape (e.g. cancel inline title edit)
        const el = document.activeElement;
        const tag = el?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
        setFocusMode((current) => (current ? false : current));
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const value = useMemo(() => ({ focusMode, setFocusMode, toggle, exit }), [focusMode, toggle, exit]);

  return (
    <FocusModeContext.Provider value={value}>
      {children}
    </FocusModeContext.Provider>
  );
}

export function useFocusMode() {
  const ctx = useContext(FocusModeContext);
  if (!ctx) throw new Error('useFocusMode must be used within FocusModeProvider');
  return ctx;
}
