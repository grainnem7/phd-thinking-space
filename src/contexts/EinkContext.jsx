import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';

const EinkContext = createContext(null);

const STORAGE_KEY = 'eink-mode';
const MONOCHROME_QUERY = '(monochrome)';

// E-ink state lives in a tiny module-level store so ThemeContext (which wraps
// this provider) can also read it and switch dark mode off while e-ink is on.
const listeners = new Set();

function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'true' ? true : saved === 'false' ? false : null;
  } catch {
    return null;
  }
}

// Explicit user choice, or null to follow a monochrome display
let explicitEink = typeof window !== 'undefined' ? readStored() : null;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(callback) {
  listeners.add(callback);
  if (typeof window === 'undefined') return () => listeners.delete(callback);

  const mq = window.matchMedia?.(MONOCHROME_QUERY);
  mq?.addEventListener('change', callback);
  // Keep tabs in sync when the choice changes elsewhere
  const onStorage = (e) => {
    if (e.key !== STORAGE_KEY && e.key !== null) return;
    explicitEink = readStored();
    callback();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(callback);
    mq?.removeEventListener('change', callback);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot() {
  if (explicitEink !== null) return explicitEink;
  return typeof window !== 'undefined' && !!window.matchMedia?.(MONOCHROME_QUERY).matches;
}

function setExplicitEink(value) {
  explicitEink = value;
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Storage unavailable - keep the in-memory choice only
  }
  emit();
}

export function useEinkSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function EinkProvider({ children }) {
  const einkMode = useEinkSnapshot();

  useEffect(() => {
    document.documentElement.classList.toggle('eink', einkMode);
  }, [einkMode]);

  // Accepts true / false, or null to go back to auto-detecting a monochrome display
  const setEinkMode = useCallback((next) => {
    const value = typeof next === 'function' ? next(getSnapshot()) : next;
    setExplicitEink(value === null ? null : !!value);
  }, []);

  const toggleEinkMode = useCallback(() => setExplicitEink(!getSnapshot()), []);

  const value = useMemo(
    () => ({ einkMode, setEinkMode, toggleEinkMode }),
    [einkMode, setEinkMode, toggleEinkMode]
  );

  return (
    <EinkContext.Provider value={value}>
      {children}
    </EinkContext.Provider>
  );
}

export function useEink() {
  const context = useContext(EinkContext);
  if (!context) {
    throw new Error('useEink must be used within an EinkProvider');
  }
  return context;
}
