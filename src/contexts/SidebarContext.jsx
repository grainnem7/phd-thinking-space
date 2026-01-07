import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SidebarContext = createContext(null);

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 260;
const COLLAPSED_WIDTH = 64;
const STORAGE_KEY = 'sidebar-width';
const COLLAPSED_KEY = 'sidebar-collapsed';

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export function SidebarProvider({ children }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    return saved === 'true';
  });
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const screenWidth = window.innerWidth;
      const mobile = screenWidth < 768;
      const tablet = screenWidth >= 768 && screenWidth < 1024;

      setIsMobile(mobile);
      setIsTablet(tablet);

      if (mobile) {
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }

      // Auto-collapse on tablet for better space usage
      if (tablet && !localStorage.getItem(COLLAPSED_KEY)) {
        setIsCollapsed(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Save width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, width.toString());
  }, [width]);

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, isCollapsed.toString());
  }, [isCollapsed]);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setWidth(newWidth);
      }
    }
  }, [isResizing]);

  // Mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      // Prevent text selection while resizing
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, resize, stopResizing]);

  const toggle = () => setIsOpen(!isOpen);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggleCollapsed = () => setIsCollapsed(!isCollapsed);
  const expand = () => setIsCollapsed(false);
  const collapse = () => setIsCollapsed(true);

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
