import { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore } from 'react';

const SidebarContext = createContext(null);

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 260;
const COLLAPSED_WIDTH = 64;
const STORAGE_KEY = 'sidebar-width';
const COLLAPSED_KEY = 'sidebar-collapsed';

const MOBILE_QUERY = '(max-width: 767.98px)';
const TABLET_QUERY = '(min-width: 768px) and (max-width: 1023.98px)';

function getMediaQuery(query) {
  if (typeof window === 'undefined' || !window.matchMedia) return null;
  return window.matchMedia(query);
}

function matches(query) {
  return !!getMediaQuery(query)?.matches;
}

function subscribeMobile(callback) {
  const mq = getMediaQuery(MOBILE_QUERY);
  mq?.addEventListener('change', callback);
  return () => mq?.removeEventListener('change', callback);
}

function subscribeTablet(callback) {
  const mq = getMediaQuery(TABLET_QUERY);
  mq?.addEventListener('change', callback);
  return () => mq?.removeEventListener('change', callback);
}

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore - preference just won't persist
  }
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export function SidebarProvider({ children }) {
  const isMobile = useSyncExternalStore(subscribeMobile, () => matches(MOBILE_QUERY), () => false);
  const isTablet = useSyncExternalStore(subscribeTablet, () => matches(TABLET_QUERY), () => false);

  const [isOpen, setIsOpen] = useState(() => !matches(MOBILE_QUERY));
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = readStored(COLLAPSED_KEY);
    if (saved !== null) return saved === 'true';
    // No explicit choice yet: start collapsed on tablets for better space usage
    return matches(TABLET_QUERY);
  });
  const [width, setWidth] = useState(() => {
    const saved = parseInt(readStored(STORAGE_KEY), 10);
    return Number.isFinite(saved) ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, saved)) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Only react when the viewport actually crosses a breakpoint. Plain resize
  // events also fire when a mobile address bar hides, or on small desktop
  // window tweaks, and must not override what the user chose.
  useEffect(() => {
    const mobileMq = getMediaQuery(MOBILE_QUERY);
    const tabletMq = getMediaQuery(TABLET_QUERY);
    if (!mobileMq || !tabletMq) return undefined;

    const onMobileChange = (e) => setIsOpen(!e.matches);
    const onTabletChange = (e) => {
      if (readStored(COLLAPSED_KEY) === null) setIsCollapsed(e.matches);
    };

    mobileMq.addEventListener('change', onMobileChange);
    tabletMq.addEventListener('change', onTabletChange);
    return () => {
      mobileMq.removeEventListener('change', onMobileChange);
      tabletMq.removeEventListener('change', onTabletChange);
    };
  }, []);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e) => {
    const newWidth = e.clientX;
    if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
      setWidth(newWidth);
    }
  }, []);

  // Mouse event listeners for resizing
  useEffect(() => {
    if (!isResizing) return undefined;

    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, resize, stopResizing]);

  // Persist the width once a drag finishes rather than on every mousemove
  useEffect(() => {
    if (!isResizing) writeStored(STORAGE_KEY, String(width));
  }, [isResizing, width]);

  const setCollapsed = useCallback((next) => {
    writeStored(COLLAPSED_KEY, String(next));
    setIsCollapsed(next);
  }, []);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggleCollapsed = useCallback(() => setCollapsed(!isCollapsed), [setCollapsed, isCollapsed]);
  const expand = useCallback(() => setCollapsed(false), [setCollapsed]);
  const collapse = useCallback(() => setCollapsed(true), [setCollapsed]);

  // Calculate effective width based on collapsed state
  const effectiveWidth = isCollapsed ? COLLAPSED_WIDTH : width;

  const value = {
    isOpen,
    isCollapsed,
    isMobile,
    isTablet,
    width,
    effectiveWidth,
    isResizing,
    toggle,
    open,
    close,
    toggleCollapsed,
    expand,
    collapse,
    startResizing,
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}
