import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useEinkSnapshot } from './EinkContext';
// Also loads the appearance store, which applies scheme/accent/font attributes
import { startAppearanceSync } from '../lib/appearanceSync';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(value) {
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable (private mode etc.) - the choice just won't survive a reload
  }
}

function subscribeSystemDark(callback) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getSystemDark() {
  return typeof window !== 'undefined' && !!window.matchMedia?.(DARK_QUERY).matches;
}

export function ThemeProvider({ children }) {
  // Explicit user choice ('light' | 'dark'), or null to follow the OS setting.
  // Only written to storage when the user actually picks something.
  const [preference, setPreference] = useState(readStoredTheme);
  const systemDark = useSyncExternalStore(subscribeSystemDark, getSystemDark, () => false);
  const einkMode = useEinkSnapshot();

  const theme = preference ?? (systemDark ? 'dark' : 'light');
  // E-reader mode always renders the light, high-contrast palette.
  const isDark = theme === 'dark' && !einkMode;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Colour scheme, accent, fonts and text size sync with the signed-in account
  // (users/{uid}/settings/appearance). Listens to Firebase auth directly because
  // this provider sits outside AuthProvider; demo mode has no Firebase user.
  useEffect(() => startAppearanceSync(), []);

  // Accepts 'light' | 'dark', or 'system' / null to go back to following the OS.
  const setTheme = useCallback((next) => {
    const value = next === 'light' || next === 'dark' ? next : null;
    writeStoredTheme(value);
    setPreference(value);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const value = useMemo(() => ({
    theme,
    preference: preference ?? 'system',
    setTheme,
    toggle,
    isDark,
    // True when dark mode is chosen but suppressed by e-reader mode
    isDarkSuppressed: theme === 'dark' && einkMode,
  }), [theme, preference, setTheme, toggle, isDark, einkMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
