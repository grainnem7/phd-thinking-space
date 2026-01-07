import { Menu, ChevronRight, PanelLeftOpen } from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';

export default function Header({ breadcrumbs = [], actions }) {
  const { toggle, isMobile, isTablet, isCollapsed, toggleCollapsed } = useSidebar();

  return (
    <header className="h-12 sm:h-14 flex items-center justify-between px-4 sm:px-6 border-b border-neutral-100 bg-white">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu toggle */}
        {isMobile && (
          <button
            onClick={toggle}
            className="p-2 -ml-2 text-neutral-400 hover:text-neutral-600 transition-colors touch-manipulation"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Tablet sidebar expand button (when collapsed) */}
        {isTablet && isCollapsed && (
          <button
            onClick={toggleCollapsed}
            className="p-2 -ml-2 text-neutral-400 hover:text-neutral-600 transition-colors touch-manipulation"
            title="Expand sidebar"
          >
            <PanelLeftOpen size={20} />
          </button>
        )}

        <nav className="flex items-center text-sm min-w-0">
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="flex items-center min-w-0">
              {index > 0 && (
                <ChevronRight size={14} className="mx-1 sm:mx-1.5 text-neutral-300 flex-shrink-0" />
              )}
              {crumb.onClick ? (
                <button
                  onClick={crumb.onClick}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors truncate touch-manipulation py-1"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-neutral-900 truncate">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {actions && (
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
