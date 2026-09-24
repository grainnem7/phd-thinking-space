import { Minimize2 } from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import { useFocusMode } from '../../contexts/FocusModeContext';
import { useEditingFocus } from '../../hooks/useEditingFocus';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

// Which bottom-bar tab a view belongs to (notes, boards, review, tags and trash are reached from Menu)
function tabFor(selectedId) {
  if (selectedId == null) return 'home';
  if (selectedId === 'calendar') return 'calendar';
  if (selectedId === 'reading-list') return 'reading';
  return 'menu';
}

export default function Layout({ children, selectedId, onSelect, onOpenSettings, onQuickAdd }) {
  const { isOpen, isMobile, open: openMenu, close: closeMenu } = useSidebar();
  const { focusMode, exit: exitFocusMode } = useFocusMode();
  const typing = useEditingFocus();
  // Phones only; out of the way in full-screen views and while typing
  const showBottomNav = isMobile && !focusMode && selectedId !== 'glance' && !typing;

  return (
    // h-dvh: the visible height, so mobile browser toolbars don't push the
    // bottom of the sidebar off-screen (h-screen is the fallback)
    <div className="flex h-screen h-dvh bg-[var(--bg-page)] overflow-hidden">
      <Sidebar selectedId={selectedId} onSelect={onSelect} onOpenSettings={onOpenSettings} />
      <main className={`flex-1 flex flex-col min-h-0 overflow-auto ${!isMobile && !isOpen ? 'w-full' : ''} ${showBottomNav ? 'pb-[var(--bottom-nav-h)]' : ''}`}>
        {children}
      </main>

      {showBottomNav && (
        <BottomNav
          current={isOpen ? 'menu' : tabFor(selectedId)}
          onHome={() => onSelect(null)}
          onCalendar={() => onSelect({ id: 'calendar', type: 'calendar', name: 'Calendar' })}
          onReading={() => onSelect({ id: 'reading-list', type: 'reading-list', name: 'Reading List' })}
          onAdd={onQuickAdd}
          onMenu={isOpen ? closeMenu : openMenu}
        />
      )}

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
