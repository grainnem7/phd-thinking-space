import { useState, useEffect, useCallback } from 'react';
import { useFirestore } from '../hooks/useFirestore';
import { useSidebar } from '../contexts/SidebarContext';
import Layout from '../components/layout/Layout';
import Header from '../components/layout/Header';
import NoteEditor from '../components/notes/NoteEditor';
import KanbanBoard from '../components/board/KanbanBoard';
import WidgetDashboard from '../components/dashboard/Dashboard';
import ReadingList from '../components/reading/ReadingList';
import { Menu, Search } from 'lucide-react';
import Button from '../components/common/Button';
import SearchInput from '../components/common/SearchInput';
import Modal from '../components/common/Modal';

export default function Dashboard() {
  const { sections, loading } = useFirestore();
  const { toggle, isOpen, isMobile } = useSidebar();
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + K: Open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      // Cmd/Ctrl + B: Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggle();
      }
      // Escape: Close modals
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  const handleSelect = useCallback((item) => {
    if (!item) {
      setSelectedItem(null);
      return;
    }

    // Handle special navigation items (reading-list, etc.)
    if (item.type === 'reading-list') {
      setSelectedItem(item);
      if (isMobile) {
        toggle();
      }
      return;
    }

    // Find the full item data from sections
    const fullItem = sections.find(s => s.id === item.id);
    if (fullItem) {
      setSelectedItem(fullItem);
      if (isMobile) {
        // Close sidebar on mobile after selection
        toggle();
      }
    }
  }, [sections, isMobile, toggle]);

  // Update selected item when sections change
  useEffect(() => {
    if (selectedItem) {
      const updated = sections.find(s => s.id === selectedItem.id);
      if (updated) {
        setSelectedItem(updated);
      }
    }
  }, [sections, selectedItem?.id]);

  const getBreadcrumbs = () => {
    if (!selectedItem) return [{ label: 'Home' }];

    const crumbs = [{ label: 'Home', onClick: () => setSelectedItem(null) }];

    // Build parent chain
    const getParentChain = (item) => {
      const chain = [];
      let current = item;
      while (current) {
        chain.unshift(current);
        current = sections.find(s => s.id === current.parentId);
      }
      return chain;
    };

    const chain = getParentChain(selectedItem);
    chain.forEach((item, index) => {
      if (index < chain.length - 1) {
        crumbs.push({
          label: item.name,
          onClick: () => handleSelect(item),
        });
      } else {
        crumbs.push({ label: item.name });
      }
    });

    return crumbs;
  };

  const filteredSections = searchQuery
    ? sections.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#fafafa]">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
        </div>
      );
    }

    if (!selectedItem) {
      // Get all notes for the recent notes widget
      const allNotes = sections.filter(s => s.type === 'note' || (!s.type && !sections.some(child => child.parentId === s.id)));
      return <WidgetDashboard notes={allNotes} sections={sections} onSelect={handleSelect} />;
    }

    // Reading List special view
    if (selectedItem.type === 'reading-list') {
      return <ReadingList />;
    }

    if (selectedItem.type === 'board') {
      return <KanbanBoard board={selectedItem} />;
    }

    // Check if this is a folder with children
    const children = sections.filter(s => s.parentId === selectedItem.id);

    // If it's explicitly a note, or has no children (leaf node), show editor
    if (selectedItem.type === 'note' || (selectedItem.type !== 'folder' && children.length === 0)) {
      return <NoteEditor note={selectedItem} sections={sections} />;
    }

    // Folder - show children
    return (
      <div className="flex-1 p-10 bg-[#fafafa]">
        <h2 className="font-serif text-2xl font-medium text-neutral-900 tracking-tight mb-6">{selectedItem.name}</h2>
        {children.length === 0 ? (
          <p className="text-sm text-neutral-400">This folder is empty. Add notes or boards from the sidebar.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => handleSelect(child)}
                className="p-4 bg-white border border-neutral-200 rounded-xl text-left hover:border-neutral-300 transition-colors"
              >
                <p className="text-base text-neutral-900">{child.name}</p>
                <p className="text-xs text-neutral-400 mt-1 capitalize">{child.type}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout selectedId={selectedItem?.id} onSelect={handleSelect}>
      <Header
        breadcrumbs={getBreadcrumbs()}
        actions={
          <>
            {!isMobile && !isOpen && (
              <Button variant="ghost" size="icon" onClick={toggle}>
                <Menu className="w-5 h-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              title="Search (Ctrl+K)"
            >
              <Search className="w-5 h-5" />
            </Button>
          </>
        }
      />
      {renderContent()}

      {/* Search Modal */}
      <Modal
        isOpen={searchOpen}
        onClose={() => {
          setSearchOpen(false);
          setSearchQuery('');
        }}
        title="Search"
        size="md"
      >
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search notes and boards..."
          className="mb-4"
        />
        {searchQuery && (
          <div className="max-h-64 overflow-y-auto">
            {filteredSections.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No results found</p>
            ) : (
              <div className="space-y-1">
                {filteredSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      handleSelect(section);
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center gap-3 p-2 text-left hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-900">{section.name}</span>
                    <span className="text-xs text-slate-500 capitalize">{section.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
