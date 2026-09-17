import { Minimize2 } from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import { useFocusMode } from '../../contexts/FocusModeContext';
import Sidebar from './Sidebar';

export default function Layout({ children, selectedId, onSelect, onOpenSettings }) {
  const { isOpen, isMobile } = useSidebar();
  const { focusMode, exit: exitFocusMode } = useFocusMode();

  return (
    <div className="flex h-screen bg-[var(--bg-page)] overflow-hidden">
      <Sidebar selectedId={selectedId} onSelect={onSelect} onOpenSettings={onOpenSettings} />
      <main className={`flex-1 flex flex-col min-h-0 overflow-auto ${!isMobile && !isOpen ? 'w-full' : ''}`}>
        {children}
      </main>

      {/* Always-available way out of focus mode, whatever view is showing */}
      {focusMode && (
        <button
          type="button"
          onClick={exitFocusMode}
          aria-label="Exit focus mode"
          title="Exit focus mode (Esc or Ctrl+Shift+F)"
          className="fixed top-3 right-3 sm:top-4 sm:right-4 z-40 inline-flex items-center gap-1.5 px-3 py-2 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 bg-white/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 rounded-lg backdrop-blur-sm transition-colors touch-manipulation"
        >
          <Minimize2 size={14} aria-hidden="true" />
          <span className="hidden sm:inline">Exit focus</span>
        </button>
      )}
    </div>
  );
}
