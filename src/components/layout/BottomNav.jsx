import { BookOpen, CalendarDays, Home, Menu, Plus } from 'lucide-react';

function Tab({ icon, label, active, onClick }) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 text-xs touch-manipulation ${active
        ? 'text-neutral-900 dark:text-neutral-100 font-semibold'
        : 'text-neutral-500 dark:text-neutral-400'}`}
    >
      <span className={`flex items-center justify-center w-14 h-8 rounded-full ${active ? 'bg-accent-soft' : ''}`}>
        <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      </span>
      {label}
    </button>
  );
}

// Phone navigation: Home, Calendar, Add, Reading and Menu within thumb reach
export default function BottomNav({ current, onHome, onCalendar, onReading, onAdd, onMenu }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-[35] bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="h-16 grid grid-cols-5 px-1.5">
        <Tab icon={Home} label="Home" active={current === 'home'} onClick={onHome} />
        <Tab icon={CalendarDays} label="Calendar" active={current === 'calendar'} onClick={onCalendar} />
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add"
            className="w-14 h-14 -mt-5 rounded-full bg-accent text-accent-fg hover:bg-accent-hover shadow-lg flex items-center justify-center touch-manipulation"
          >
            <Plus size={26} aria-hidden="true" />
          </button>
        </div>
        <Tab icon={BookOpen} label="Reading" active={current === 'reading'} onClick={onReading} />
        <Tab icon={Menu} label="Menu" active={current === 'menu'} onClick={onMenu} />
      </div>
    </nav>
  );
}
