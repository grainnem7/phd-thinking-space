import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const FocusModeContext = createContext(null);

export function FocusModeProvider({ children }) {
  const [focusMode, setFocusMode] = useState(() => {
    return localStorage.getItem('note-focus-mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('note-focus-mode', String(focusMode));
  }, [focusMode]);

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

  return (
    <FocusModeContext.Provider value={{ focusMode, setFocusMode, toggle, exit }}>
      {children}
    </FocusModeContext.Provider>
  );
}

export function useFocusMode() {
  const ctx = useContext(FocusModeContext);
  if (!ctx) throw new Error('useFocusMode must be used within FocusModeProvider');
  return ctx;
}
