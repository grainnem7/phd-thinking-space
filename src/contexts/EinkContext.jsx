import { createContext, useContext, useState, useEffect } from 'react';

const EinkContext = createContext();

export function EinkProvider({ children }) {
  // Check localStorage and media query on init
  const [einkMode, setEinkMode] = useState(() => {
    const saved = localStorage.getItem('eink-mode');
    if (saved !== null) {
      return saved === 'true';
    }
    // Auto-detect monochrome display
    if (typeof window !== 'undefined') {
      return window.matchMedia('(monochrome)').matches;
    }
    return false;
  });

  // Update body class and localStorage when mode changes
  useEffect(() => {
    document.documentElement.classList.toggle('eink', einkMode);
    localStorage.setItem('eink-mode', einkMode.toString());
  }, [einkMode]);

  // Listen for media query changes (e.g., connecting external display)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(monochrome)');
    const handler = (e) => {
      // Only auto-switch if user hasn't manually set preference
      const saved = localStorage.getItem('eink-mode');
      if (saved === null) {
        setEinkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const toggleEinkMode = () => setEinkMode(prev => !prev);

  return (
    <EinkContext.Provider value={{ einkMode, setEinkMode, toggleEinkMode }}>
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
