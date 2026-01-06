import { Menu, ChevronRight } from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';

export default function Header({ breadcrumbs = [], actions }) {
  const { toggle, isMobile } = useSidebar();

  return (
    <header className="h-12 flex items-center justify-between px-6 border-b border-neutral-100 bg-white">
      <div className="flex items-center gap-3">
        {isMobile && (
          <button onClick={toggle} className="text-neutral-400 hover:text-neutral-600 transition-colors">
            <Menu size={18} />
          </button>
        )}

        <nav className="flex items-center text-sm">
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight size={14} className="mx-1.5 text-neutral-300" />
              )}
              {crumb.onClick ? (
                <button
                  onClick={crumb.onClick}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-neutral-900">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
