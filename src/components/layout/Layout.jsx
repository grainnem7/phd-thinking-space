import { useSidebar } from '../../contexts/SidebarContext';
import Sidebar from './Sidebar';

export default function Layout({ children, selectedId, onSelect }) {
  const { isOpen, isMobile } = useSidebar();

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar selectedId={selectedId} onSelect={onSelect} />
      <main className={`flex-1 flex flex-col overflow-hidden ${!isMobile && !isOpen ? 'w-full' : ''}`}>
        {children}
      </main>
    </div>
  );
}
