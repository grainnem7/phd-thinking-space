import { Menu, ChevronRight } from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import Button from '../common/Button';

export default function Header({ breadcrumbs = [], actions }) {
  const { toggle, isMobile } = useSidebar();

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-3">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={toggle}>
            <Menu className="w-5 h-5" />
          </Button>
        )}

        <nav className="flex items-center text-sm">
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 mx-1 text-slate-400" />
              )}
              {crumb.onClick ? (
                <button
                  onClick={crumb.onClick}
                  className="text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-slate-900 font-medium">{crumb.label}</span>
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
