import { useState, useEffect, useCallback } from 'react';
import { useFirestore } from '../hooks/useFirestore';
import { useSidebar } from '../contexts/SidebarContext';
import { useFocusMode } from '../contexts/FocusModeContext';
import { useConfirm } from '../components/common/ConfirmDialog';
import Layout from '../components/layout/Layout';
import Header from '../components/layout/Header';
import NoteEditor from '../components/notes/NoteEditor';
import KanbanBoard from '../components/board/KanbanBoard';
import WidgetDashboard from '../components/dashboard/Dashboard';
import ReadingList from '../components/reading-list/ReadingList';
import { Menu, Search, Plus, FileText, Kanban, Folder, MoreVertical, Pencil, Trash2, Copy, Moon, Sun, Maximize2, BookOpen, Keyboard } from 'lucide-react';
import Button from '../components/common/Button';
import SearchInput from '../components/common/SearchInput';
import Modal from '../components/common/Modal';
import CommandPalette from '../components/common/CommandPalette';
import { useTheme } from '../contexts/ThemeContext';

export default function Dashboard() {
  const { sections, loading, addSection, updateSection, deleteSection, duplicateSection } = useFirestore();
  const { toggle, isOpen, isMobile } = useSidebar();
  const { focusMode, toggle: toggleFocusMode } = useFocusMode();
  const { isDark, toggle: toggleTheme } = useTheme();
  const confirm = useConfirm();
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [itemMenuOpen, setItemMenuOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

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
      // ?: open keyboard shortcuts help (only when not typing)
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = document.activeElement;
        const tag = el?.tagName;
        const inEditable = tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable;
        if (!inEditable) {
          e.preventDefault();
          setShortcutsOpen(true);
        }
      }
      // Escape: Close modals
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setIsCreating(false);
        setItemMenuOpen(false);
        setShortcutsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!isCreating && !itemMenuOpen) return;

    const handleClickOutside = () => {
      setIsCreating(false);
      setItemMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isCreating, itemMenuOpen]);

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

  // Item action handlers
  const openRename = (item) => {
    setRenameTarget(item);
    setNewName(item.name);
    setRenameModalOpen(true);
  };

  const handleRename = () => {
    if (selectedItem) {
      openRename(selectedItem);
      setItemMenuOpen(false);
    }
  };

  const handleRenameSubmit = async () => {
    if (renameTarget && newName.trim()) {
      await updateSection(renameTarget.id, { name: newName.trim() });
      setRenameModalOpen(false);
      setRenameTarget(null);
      setNewName('');
    }
  };

  const handleDuplicate = async () => {
    if (selectedItem) {
      await duplicateSection(selectedItem.id);
      setItemMenuOpen(false);
    }
  };

  const handleDelete = () => {
    if (selectedItem) {
      setDeleteModalOpen(true);
      setItemMenuOpen(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedItem) {
      // Navigate to parent or home before deleting
      const parent = sections.find(s => s.id === selectedItem.parentId);
      setSelectedItem(parent || null);
      await deleteSection(selectedItem.id);
      setDeleteModalOpen(false);
    }
  };

  const handleChildRename = (e, child) => {
    e.stopPropagation();
    openRename(child);
  };

  const handleChildDelete = async (e, child) => {
    e.stopPropagation();
    const childCount = sections.filter(s => s.parentId === child.id).length;
    const ok = await confirm({
      title: `Delete "${child.name}"?`,
      body: childCount > 0
        ? `This will also delete ${childCount} ${childCount === 1 ? 'item' : 'items'} inside it. This cannot be undone.`
        : 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) {
      // If we deleted the currently-selected item, navigate to its parent
      if (selectedItem && (selectedItem.id === child.id || sections.some(s => s.id === selectedItem.id && s.parentId === child.id))) {
        const parent = sections.find(s => s.id === child.parentId);
        setSelectedItem(parent || null);
      }
      await deleteSection(child.id);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#fafafa] dark:bg-neutral-950">
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
      return (
        <KanbanBoard
          board={selectedItem}
          onRename={(b) => openRename(b)}
          onDelete={async (id) => {
            const parent = sections.find(s => s.id === selectedItem.parentId);
            setSelectedItem(parent || null);
            await deleteSection(id);
          }}
        />
      );
    }

    // Check if this is a folder with children
    const children = sections.filter(s => s.parentId === selectedItem.id);

    // If it's explicitly a note, or has no children (leaf node), show editor
    if (selectedItem.type === 'note' || (selectedItem.type !== 'folder' && children.length === 0)) {
      return (
        <NoteEditor
          note={selectedItem}
          sections={sections}
          updateSection={updateSection}
          onDelete={async (id) => {
            const parent = sections.find(s => s.id === selectedItem.parentId);
            setSelectedItem(parent || null);
            await deleteSection(id);
          }}
        />
      );
    }

    // Folder - show children
    return (
      <div className="flex-1 p-6 sm:p-10 bg-[#fafafa] dark:bg-neutral-950">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl font-medium text-neutral-900 dark:text-neutral-100 tracking-tight">{selectedItem.name}</h2>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setIsCreating(!isCreating); }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
            >
              <Plus size={16} />
              Add
            </button>
            {isCreating && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 z-10">
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
                className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
              >
                <FileText size={16} />
                Add Note
              </button>
              <button
                onClick={() => handleCreateItem('board')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
              >
                <Kanban size={16} />
                Add Board
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((child) => (
              <div
                key={child.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(child)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(child);
                  }
                }}
                className="relative p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-left hover:border-neutral-300 dark:hover:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 pr-16">
                  {child.type === 'note' && <FileText size={18} className="text-neutral-400" />}
                  {child.type === 'board' && <Kanban size={18} className="text-neutral-400" />}
                  {child.type === 'folder' && <Folder size={18} className="text-neutral-400" />}
                  {!child.type && <FileText size={18} className="text-neutral-400" />}
                  <p className="text-base text-neutral-900 dark:text-neutral-100 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 truncate">{child.name}</p>
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => handleChildRename(e, child)}
                    aria-label={`Rename ${child.name}`}
                    title="Rename"
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 bg-white rounded transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleChildDelete(e, child)}
                    aria-label={`Delete ${child.name}`}
                    title="Delete"
                    className="p-1.5 text-neutral-400 hover:text-red-500 bg-white rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout selectedId={selectedItem?.id} onSelect={handleSelect}>
      {!focusMode && (
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
            {/* Item actions menu - shown when viewing an item */}
            {selectedItem && selectedItem.type !== 'reading-list' && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); setItemMenuOpen(!itemMenuOpen); }}
                  title="More actions"
                >
                  <MoreVertical className="w-5 h-5" />
                </Button>
                {itemMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-1 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-20"
                  >
                    <button
                      onClick={handleRename}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100 transition-colors touch-manipulation"
                    >
                      <Pencil size={16} className="text-neutral-400" />
                      Rename
                    </button>
                    <button
                      onClick={handleDuplicate}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100 transition-colors touch-manipulation"
                    >
                      <Copy size={16} className="text-neutral-400" />
                      Duplicate
                    </button>
                    <div className="border-t border-neutral-100 my-1" />
                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors touch-manipulation"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        }
      />
      )}
      {renderContent()}

      {/* Command Palette */}
      <CommandPalette
        open={searchOpen}
        onOpenChange={(v) => { setSearchOpen(v); if (!v) setSearchQuery(''); }}
        sections={sections}
        actions={[
          { id: 'add-note', label: 'New note', icon: FileText, keywords: 'create add', run: () => handleCreateItem('note') },
          { id: 'add-board', label: 'New board', icon: Kanban, keywords: 'create add tasks kanban', run: () => handleCreateItem('board') },
          { id: 'add-folder', label: 'New folder', icon: Folder, keywords: 'create add', run: () => handleCreateItem('folder') },
          { id: 'reading-list', label: 'Open Reading List', icon: BookOpen, keywords: 'papers references', run: () => handleSelect({ id: 'reading-list', type: 'reading-list', name: 'Reading List' }) },
          { id: 'toggle-dark', label: isDark ? 'Switch to light mode' : 'Switch to dark mode', icon: isDark ? Sun : Moon, keywords: 'theme color', run: toggleTheme },
          { id: 'toggle-focus', label: focusMode ? 'Exit focus mode' : 'Enter focus mode', icon: Maximize2, keywords: 'distraction-free zen', shortcut: 'Ctrl+Shift+F', run: toggleFocusMode },
          { id: 'shortcuts', label: 'Keyboard shortcuts', icon: Keyboard, keywords: 'help hotkeys', shortcut: '?', run: () => setShortcutsOpen(true) },
        ]}
        onNavigate={handleSelect}
      />

      {/* Rename Modal */}
      <Modal
        isOpen={renameModalOpen}
        onClose={() => {
          setRenameModalOpen(false);
          setRenameTarget(null);
          setNewName('');
        }}
        title="Rename"
        size="sm"
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Enter new name..."
          autoFocus
          className="w-full px-4 py-3 text-base border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-300 focus:border-neutral-300 outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleRenameSubmit();
            }
          }}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => { setRenameModalOpen(false); setRenameTarget(null); setNewName(''); }}>
            Cancel
          </Button>
          <Button onClick={handleRenameSubmit}>
            Save
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Item"
        size="sm"
      >
        <p className="text-neutral-600">
          Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </div>
      </Modal>

      {/* Keyboard shortcuts help */}
      <Modal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title="Keyboard shortcuts"
        size="sm"
      >
        <ul className="space-y-3">
          {[
            { keys: 'Ctrl + K', label: 'Open command palette' },
            { keys: 'Ctrl + B', label: 'Toggle sidebar' },
            { keys: 'Ctrl + Shift + F', label: 'Toggle focus mode' },
            { keys: '?', label: 'Show this help' },
            { keys: 'Esc', label: 'Close modals / exit focus mode' },
            { keys: 'Enter', label: 'Confirm forms; save inline edits' },
          ].map((row) => (
            <li key={row.keys} className="flex items-center justify-between gap-4">
              <span className="text-sm text-neutral-700 dark:text-neutral-200">{row.label}</span>
              <kbd className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-neutral-600 dark:text-neutral-300 font-mono whitespace-nowrap">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-neutral-400 dark:text-neutral-500">
          On Mac, Ctrl works the same way (or use ⌘).
        </p>
      </Modal>
    </Layout>
  );
}
