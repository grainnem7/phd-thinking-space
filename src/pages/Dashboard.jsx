import { useState, useEffect, useCallback } from 'react';
import { useFirestore } from '../hooks/useFirestore';
import { useSidebar } from '../contexts/SidebarContext';
import Layout from '../components/layout/Layout';
import Header from '../components/layout/Header';
import NoteEditor from '../components/notes/NoteEditor';
import KanbanBoard from '../components/board/KanbanBoard';
import { Menu, Search, BookOpen } from 'lucide-react';
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
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      );
    }

    if (!selectedItem) {
      return (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Welcome to PhD Thinking Space
            </h2>
            <p className="text-slate-600 mb-6">
              Your personal knowledge management tool for organizing research, notes, and tasks.
            </p>
            <div className="text-sm text-slate-500 space-y-1">
              <p><kbd className="px-2 py-1 bg-slate-200 rounded text-xs">Ctrl+K</kbd> to search</p>
              <p><kbd className="px-2 py-1 bg-slate-200 rounded text-xs">Ctrl+B</kbd> to toggle sidebar</p>
            </div>
          </div>
        </div>
      );
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
      <div className="flex-1 p-6 bg-slate-50">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">{selectedItem.name}</h2>
        {children.length === 0 ? (
          <p className="text-slate-500">This folder is empty. Add notes or boards from the sidebar.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => handleSelect(child)}
                className="p-4 bg-white rounded-xl border border-slate-200 text-left hover:border-blue-500 hover:shadow-md transition-all"
              >
                <h3 className="font-medium text-slate-900">{child.name}</h3>
                <p className="text-sm text-slate-500 mt-1 capitalize">{child.type}</p>
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
