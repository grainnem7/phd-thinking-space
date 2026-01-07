import { useState, useEffect, useCallback } from 'react';
import { useFirestore } from '../hooks/useFirestore';
import { useSidebar } from '../contexts/SidebarContext';
import Layout from '../components/layout/Layout';
import Header from '../components/layout/Header';
import NoteEditor from '../components/notes/NoteEditor';
import KanbanBoard from '../components/board/KanbanBoard';
import WidgetDashboard from '../components/dashboard/Dashboard';
import ReadingList from '../components/reading/ReadingList';
import { Menu, Search, Plus, FileText, Kanban, Folder } from 'lucide-react';
import Button from '../components/common/Button';
import SearchInput from '../components/common/SearchInput';
import Modal from '../components/common/Modal';

export default function Dashboard() {
  const { sections, loading, addSection } = useFirestore();
  const { toggle, isOpen, isMobile } = useSidebar();
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

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
        setIsCreating(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isCreating) return;

    const handleClickOutside = () => setIsCreating(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isCreating]);

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

  const handleCreateItem = async (type) => {
    const parentId = selectedItem?.id || null;
    const siblings = sections.filter(s => s.parentId === parentId);
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order || 0)) : -1;

    const newItem = {
      name: type === 'note' ? 'Untitled Note' : type === 'board' ? 'Untitled Board' : 'New Folder',
      type,
      parentId,
      order: maxOrder + 1,
      ...(type === 'board' && {
        columns: [
          { id: 'todo', name: 'To Do', order: 0 },
          { id: 'in-progress', name: 'In Progress', order: 1 },
          { id: 'done', name: 'Done', order: 2 },
        ],
        tasks: [],
      }),
    };

    const newId = await addSection(newItem);
    if (newId) {
      // Navigate to the new item
      handleSelect({ id: newId, ...newItem });
    }
    setIsCreating(false);
  };

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
      <div className="flex-1 p-6 sm:p-10 bg-[#fafafa]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl font-medium text-neutral-900 tracking-tight">{selectedItem.name}</h2>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setIsCreating(!isCreating); }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors"
            >
              <Plus size={16} />
              Add
            </button>
            {isCreating && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-2 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-10">
                <button
                  onClick={() => handleCreateItem('note')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  <FileText size={16} className="text-neutral-400" />
                  New Note
                </button>
                <button
                  onClick={() => handleCreateItem('board')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  <Kanban size={16} className="text-neutral-400" />
                  New Board
                </button>
                <button
                  onClick={() => handleCreateItem('folder')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  <Folder size={16} className="text-neutral-400" />
                  New Folder
                </button>
              </div>
            )}
          </div>
        </div>
        {children.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
              <Folder size={24} className="text-neutral-400" />
            </div>
            <p className="text-neutral-500 mb-4">This folder is empty</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleCreateItem('note')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors"
              >
                <FileText size={16} />
                Add Note
              </button>
              <button
                onClick={() => handleCreateItem('board')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors"
              >
                <Kanban size={16} />
                Add Board
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => handleSelect(child)}
                className="p-4 bg-white border border-neutral-200 rounded-xl text-left hover:border-neutral-300 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {child.type === 'note' && <FileText size={18} className="text-neutral-400" />}
                  {child.type === 'board' && <Kanban size={18} className="text-neutral-400" />}
                  {child.type === 'folder' && <Folder size={18} className="text-neutral-400" />}
                  {!child.type && <FileText size={18} className="text-neutral-400" />}
                  <p className="text-base text-neutral-900 group-hover:text-neutral-700">{child.name}</p>
                </div>
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
