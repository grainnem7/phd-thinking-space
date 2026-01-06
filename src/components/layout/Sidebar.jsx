import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  FolderPlus,
  FileText,
  Layout,
  LogOut,
  MoreHorizontal,
  Trash2,
  Copy,
  Pencil,
  Code,
  PenTool,
  Lightbulb,
  BookOpenCheck,
  HelpCircle,
  Book,
  Compass,
  Kanban,
  X,
} from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import { useAuth } from '../../hooks/useAuth';
import { useFirestore } from '../../hooks/useFirestore';
import SearchInput from '../common/SearchInput';
import Dropdown, { DropdownItem } from '../common/Dropdown';
import Modal from '../common/Modal';
import Button from '../common/Button';

const iconMap = {
  'code': Code,
  'pen-tool': PenTool,
  'layout': Layout,
  'lightbulb': Lightbulb,
  'book-open': BookOpenCheck,
  'help-circle': HelpCircle,
  'book': Book,
  'compass': Compass,
  'file-text': FileText,
  'kanban': Kanban,
  'folder': FolderPlus,
};

function getIcon(iconName) {
  return iconMap[iconName] || FileText;
}

function SortableItem({ item, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function TreeItem({
  item,
  level = 0,
  sections,
  selectedId,
  onSelect,
  expandedIds,
  toggleExpanded,
  onContextMenu,
  searchQuery,
}) {
  const Icon = getIcon(item.icon);
  const children = sections.filter(s => s.parentId === item.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(item.id);
  const isSelected = selectedId === item.id;

  const matchesSearch = searchQuery
    ? item.name.toLowerCase().includes(searchQuery.toLowerCase())
    : true;

  if (!matchesSearch && children.length === 0) return null;

  return (
    <SortableItem item={item}>
      <div>
        <div
          className={`group flex items-center gap-1 px-2 py-1.5 mx-2 rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? 'bg-blue-100 text-blue-700'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => onSelect(item)}
        >
          {hasChildren || item.type === 'folder' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(item.id);
              }}
              className="p-0.5 hover:bg-slate-200 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-sm truncate">{item.name}</span>
          <Dropdown
            align="right"
            trigger={
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-200 rounded transition-all text-slate-500 hover:text-slate-700"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            }
          >
            {({ close }) => (
              <>
                {(item.type === 'folder' || hasChildren) && (
                  <>
                    <DropdownItem onClick={() => { onContextMenu('add-note', item); close(); }}>
                      <FileText className="w-4 h-4" /> Add Note
                    </DropdownItem>
                    <DropdownItem onClick={() => { onContextMenu('add-folder', item); close(); }}>
                      <FolderPlus className="w-4 h-4" /> Add Subfolder
                    </DropdownItem>
                    <div className="border-t border-slate-200 my-1" />
                  </>
                )}
                <DropdownItem onClick={() => { onContextMenu('rename', item); close(); }}>
                  <Pencil className="w-4 h-4" /> Rename
                </DropdownItem>
                <DropdownItem onClick={() => { onContextMenu('duplicate', item); close(); }}>
                  <Copy className="w-4 h-4" /> Duplicate
                </DropdownItem>
                <DropdownItem danger onClick={() => { onContextMenu('delete', item); close(); }}>
                  <Trash2 className="w-4 h-4" /> Delete
                </DropdownItem>
              </>
            )}
          </Dropdown>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {children
              .sort((a, b) => a.order - b.order)
              .map((child) => (
                <TreeItem
                  key={child.id}
                  item={child}
                  level={level + 1}
                  sections={sections}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  expandedIds={expandedIds}
                  toggleExpanded={toggleExpanded}
                  onContextMenu={onContextMenu}
                  searchQuery={searchQuery}
                />
              ))}
          </div>
        )}
      </div>
    </SortableItem>
  );
}

export default function Sidebar({ selectedId, onSelect }) {
  const { isOpen, close, isMobile } = useSidebar();
  const { user, logout } = useAuth();
  const { sections, addSection, updateSection, deleteSection, duplicateSection, reorderSections } = useFirestore();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [modalState, setModalState] = useState({ type: null, item: null });
  const [newItemName, setNewItemName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const rootSections = useMemo(() => {
    return sections
      .filter(s => s.parentId === null)
      .sort((a, b) => a.order - b.order);
  }, [sections]);

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContextMenu = (action, item) => {
    switch (action) {
      case 'rename':
        setNewItemName(item.name);
        setModalState({ type: 'rename', item });
        break;
      case 'duplicate':
        duplicateSection(item.id);
        break;
      case 'delete':
        setModalState({ type: 'delete', item });
        break;
      case 'add-note':
        setNewItemName('');
        setModalState({ type: 'add-child', itemType: 'note', parentItem: item });
        // Auto-expand the parent folder
        setExpandedIds(prev => new Set([...prev, item.id]));
        break;
      case 'add-folder':
        setNewItemName('');
        setModalState({ type: 'add-child', itemType: 'folder', parentItem: item });
        // Auto-expand the parent folder
        setExpandedIds(prev => new Set([...prev, item.id]));
        break;
    }
  };

  const handleAddSection = (type) => {
    setNewItemName('');
    setModalState({ type: 'add', itemType: type });
  };

  const handleModalSubmit = async () => {
    if (modalState.type === 'add' && newItemName.trim()) {
      const newSection = {
        name: newItemName.trim(),
        icon: modalState.itemType === 'folder' ? 'folder' : modalState.itemType === 'board' ? 'kanban' : 'file-text',
        order: rootSections.length,
        parentId: null,
        type: modalState.itemType,
        ...(modalState.itemType === 'note' && { content: '' }),
        ...(modalState.itemType === 'board' && {
          columns: [
            { id: 'backlog', name: 'Backlog', order: 0 },
            { id: 'in-progress', name: 'In Progress', order: 1 },
            { id: 'review', name: 'Review', order: 2 },
            { id: 'done', name: 'Done', order: 3 },
          ],
          tasks: [],
        }),
      };
      await addSection(newSection);
    } else if (modalState.type === 'add-child' && newItemName.trim()) {
      // Add child item inside a folder
      const siblings = sections.filter(s => s.parentId === modalState.parentItem.id);
      const newSection = {
        name: newItemName.trim(),
        icon: modalState.itemType === 'folder' ? 'folder' : 'file-text',
        order: siblings.length,
        parentId: modalState.parentItem.id,
        type: modalState.itemType,
        ...(modalState.itemType === 'note' && { content: '' }),
      };
      await addSection(newSection);
    } else if (modalState.type === 'rename' && newItemName.trim()) {
      await updateSection(modalState.item.id, { name: newItemName.trim() });
    } else if (modalState.type === 'delete') {
      await deleteSection(modalState.item.id);
      if (selectedId === modalState.item.id) {
        onSelect(null);
      }
    }
    setModalState({ type: null, item: null });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = rootSections.findIndex(s => s.id === active.id);
      const newIndex = rootSections.findIndex(s => s.id === over.id);

      const reordered = [...rootSections];
      const [removed] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, removed);

      reorderSections(reordered);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarClasses = isMobile
    ? `fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`
    : `w-72 bg-white border-r border-slate-200 flex-shrink-0 ${isOpen ? '' : 'hidden'}`;

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={close}
        />
      )}

      <aside className={sidebarClasses}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <span className="font-semibold text-slate-900">PhD Space</span>
            </div>
            {isMobile && (
              <button onClick={close} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            )}
          </div>

          {/* Search */}
          <div className="p-3">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search..."
            />
          </div>

          {/* Navigation Tree */}
          <div className="flex-1 overflow-y-auto py-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={rootSections.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {rootSections.map((section) => (
                  <TreeItem
                    key={section.id}
                    item={section}
                    sections={sections}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    expandedIds={expandedIds}
                    toggleExpanded={toggleExpanded}
                    onContextMenu={handleContextMenu}
                    searchQuery={searchQuery}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          {/* Add Buttons */}
          <div className="p-3 border-t border-slate-200 space-y-1">
            <button
              onClick={() => handleAddSection('folder')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              Add Section
            </button>
            <button
              onClick={() => handleAddSection('note')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              Add Note
            </button>
            <button
              onClick={() => handleAddSection('board')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Layout className="w-4 h-4" />
              Add Board
            </button>
          </div>

          {/* User Profile */}
          <div className="p-3 border-t border-slate-200">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">
                    {user?.displayName?.[0] || 'U'}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {user?.displayName || 'User'}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Add/Rename Modal */}
      <Modal
        isOpen={modalState.type === 'add' || modalState.type === 'add-child' || modalState.type === 'rename'}
        onClose={() => setModalState({ type: null, item: null })}
        title={
          modalState.type === 'add'
            ? `New ${modalState.itemType}`
            : modalState.type === 'add-child'
            ? `New ${modalState.itemType} in "${modalState.parentItem?.name}"`
            : 'Rename'
        }
        size="sm"
      >
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="Enter name..."
          autoFocus
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleModalSubmit();
            }
          }}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setModalState({ type: null, item: null })}>
            Cancel
          </Button>
          <Button onClick={handleModalSubmit}>
            {modalState.type === 'add' || modalState.type === 'add-child' ? 'Create' : 'Save'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={modalState.type === 'delete'}
        onClose={() => setModalState({ type: null, item: null })}
        title="Delete Item"
        size="sm"
      >
        <p className="text-slate-600">
          Are you sure you want to delete "{modalState.item?.name}"? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setModalState({ type: null, item: null })}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleModalSubmit}>
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
