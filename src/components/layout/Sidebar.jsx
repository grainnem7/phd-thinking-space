import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  MeasuringStrategy,
  useDroppable,
} from '@dnd-kit/core';
import { useTouchFriendlySensors } from '../../lib/dndSensors';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
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
  Search,
  BookMarked,
  CalendarDays,
  ClipboardList,
  Tag,
  Settings,
  Home,
  Monitor,
  Sun,
  Moon,
  UserPlus,
  FolderInput,
  CornerLeftUp,
} from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import { useAuth } from '../../hooks/useAuth';
import { useFirestore } from '../../hooks/useFirestore';
import { useEink } from '../../contexts/EinkContext';
import { useFocusMode } from '../../contexts/FocusModeContext';
import { useTheme } from '../../contexts/ThemeContext';
import { defaultBoardColumns } from '../../lib/defaults';
import Dropdown, { DropdownItem } from '../common/Dropdown';
import Modal from '../common/Modal';
import Button from '../common/Button';
import MoveToModal from '../sections/MoveToModal';
import { canMoveSection, subtreeIds } from '../../lib/sectionTree';

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

const ROOT_GROUP = 'root';

function groupIdFor(parentId) {
  return parentId == null ? ROOT_GROUP : `group-${parentId}`;
}

function sortableGroupOf(entry) {
  return entry?.data?.current?.sortable?.containerId;
}

// Droppable ids for "drop inside this folder" and "move to the top level"
const INTO_PREFIX = 'into:';
const ROOT_ZONE = 'root-zone';
// How long a dragged item must hover a collapsed folder before it opens
const HOVER_EXPAND_MS = 600;

// Reordering: only let items collide with their siblings, so a reorder never
// "lands" in a different folder. Moving into folders uses the drop targets below.
function siblingCollisionDetection(args) {
  const group = sortableGroupOf(args.active);
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => sortableGroupOf(c) === group),
  });
}

// Same restriction for keyboard dragging (Space to pick up, arrows to move)
function siblingKeyboardCoordinates(event, args) {
  const { context } = args;
  const group = sortableGroupOf(context.active);
  const all = context.droppableContainers;
  const scoped = {
    getEnabled: () => all.getEnabled().filter((c) => sortableGroupOf(c) === group),
    get: (id) => all.get(id),
  };
  return sortableKeyboardCoordinates(event, { ...args, context: { ...context, droppableContainers: scoped } });
}

// Pointer drags: the middle of a folder row (or the top-level zone) moves the
// item inside; the row's top and bottom edges still reorder among siblings.
function createCollisionDetection(sections) {
  return (args) => {
    const { active, pointerCoordinates, droppableContainers, droppableRects } = args;
    if (pointerCoordinates) {
      const { x, y } = pointerCoordinates;
      const activeItem = sections.find((s) => s.id === active.id);
      const activeParentId = activeItem?.parentId ?? null;
      for (const container of droppableContainers) {
        const data = container.data.current;
        if (data?.kind !== 'into' && data?.kind !== 'root') continue;
        const rect = droppableRects.get(container.id);
        if (!rect || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
        if (data.kind === 'root') {
          if (activeParentId !== null) return [{ id: container.id, data: { droppableContainer: container, value: 0 } }];
          continue;
        }
        const edge = rect.height * 0.25;
        const inMiddle = y > rect.top + edge && y < rect.bottom - edge;
        if (inMiddle && data.folderId !== activeParentId && canMoveSection(sections, active.id, data.folderId)) {
          return [{ id: container.id, data: { droppableContainer: container, value: 0 } }];
        }
      }
    }
    return siblingCollisionDetection(args);
  };
}

function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_ZONE, data: { kind: 'root' } });
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 mt-2 px-3 py-2.5 text-sm rounded-lg border border-dashed transition-colors ${
        isOver
          ? 'border-neutral-500 bg-neutral-100 text-neutral-900 dark:border-neutral-400 dark:bg-neutral-800 dark:text-neutral-100'
          : 'border-neutral-300 text-neutral-400 dark:border-neutral-700 dark:text-neutral-500'
      }`}
    >
      <CornerLeftUp size={15} aria-hidden="true" />
      Move to top level
    </div>
  );
}

const KEYBOARD_CODES = {
  // Enter selects the row, so only Space picks an item up
  start: ['Space'],
  cancel: ['Escape'],
  end: ['Space', 'Enter'],
};

// Shared class fragments
const ROW_BASE = 'rounded-lg cursor-pointer transition-colors touch-manipulation focus-visible:-outline-offset-2';
const ROW_SELECTED = 'bg-accent-soft text-accent-ink font-medium';
const ROW_IDLE = 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 active:bg-neutral-100 dark:active:bg-neutral-800';
const FOOTER_TEXT_BUTTON = 'text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200 transition-colors';
const INPUT_CLASS = 'w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-neutral-900 dark:text-neutral-100';

function SortableItem({ id, disabled, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  };

  // The node (incl. nested children) moves; only the row itself starts a drag
  return (
    <div ref={setNodeRef} style={style}>
      {children({ activatorRef: setActivatorNodeRef, attributes, listeners, isDragging })}
    </div>
  );
}

function TreeItem({
  item,
  level = 0,
  childrenByParent,
  selectedId,
  onSelect,
  expandedIds,
  toggleExpanded,
  onContextMenu,
  searchVisibleIds,
}) {
  const allChildren = childrenByParent.get(item.id) ?? [];
  const isSearching = searchVisibleIds !== null;
  const visibleChildren = isSearching
    ? allChildren.filter((c) => searchVisibleIds.has(c.id))
    : allChildren;
  const hasChildren = allChildren.length > 0;
  const isFolderLike = hasChildren || item.type === 'folder';
  // While searching, folders containing matches are shown expanded
  const isExpanded = isSearching ? visibleChildren.length > 0 : expandedIds.has(item.id);
  const isSelected = selectedId === item.id;
  const name = item.name || 'Untitled';
  // Items can be dropped inside real folders (and older untyped items with children)
  const acceptsDrops = item.type === 'folder' || (!item.type && hasChildren);
  const { setNodeRef: setDropRef, isOver: isDropTarget } = useDroppable({
    id: `${INTO_PREFIX}${item.id}`,
    data: { kind: 'into', folderId: item.id },
    disabled: isSearching || !acceptsDrops,
  });

  return (
    <SortableItem id={item.id} disabled={isSearching}>
      {({ activatorRef, attributes, listeners, isDragging }) => (
        <>
          <div
            ref={(node) => {
              activatorRef(node);
              setDropRef(node);
            }}
            {...attributes}
            {...listeners}
            role="button"
            tabIndex={0}
            aria-current={isSelected ? 'page' : undefined}
            className={`group flex items-center justify-between gap-1 pr-1 py-1.5 mb-0.5 ${ROW_BASE} ${
              isDropTarget
                ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 ring-2 ring-inset ring-neutral-400 dark:ring-neutral-500'
                : isSelected ? ROW_SELECTED : ROW_IDLE
            }`}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={() => onSelect(item)}
            onKeyDown={(e) => {
              listeners?.onKeyDown?.(e);
              // Ignore keys from nested buttons/menus and while keyboard-dragging
              if (e.defaultPrevented || isDragging || e.target !== e.currentTarget) return;
              if (e.key === 'Enter') {
                e.preventDefault();
                onSelect(item);
              } else if (e.key === 'ArrowRight' && isFolderLike && !isExpanded && !isSearching) {
                e.preventDefault();
                toggleExpanded(item.id);
              } else if (e.key === 'ArrowLeft' && isFolderLike && isExpanded && !isSearching) {
                e.preventDefault();
                toggleExpanded(item.id);
              }
            }}
          >
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {isFolderLike ? (
                isSearching ? (
                  <span className="p-1.5 flex-shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden="true">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(item.id);
                    }}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${name}`}
                    aria-expanded={isExpanded}
                    className="p-1.5 flex-shrink-0 rounded text-neutral-400 dark:text-neutral-500 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 transition-colors touch-manipulation"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                )
              ) : (
                <span className="w-7 flex-shrink-0" />
              )}
              <span className="text-sm truncate py-1.5">{name}</span>
            </div>
            {/* Keep menu clicks/drags from selecting or dragging the row */}
            <div
              className="flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Dropdown
                align="right"
                trigger={
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Actions for ${name}`}
                    aria-haspopup="menu"
                    title="Item actions"
                    className={`p-2 rounded text-neutral-400 hover:text-neutral-700 active:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-opacity touch-manipulation focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 ${
                      isSelected ? '' : '[@media(hover:hover)]:opacity-0'
                    }`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                }
              >
                {({ close }) => (
                  <>
                    {isFolderLike && (
                      <>
                        <DropdownItem onClick={() => { onContextMenu('add-note', item); close(); }}>
                          <FileText className="w-4 h-4" /> Add Note
                        </DropdownItem>
                        <DropdownItem onClick={() => { onContextMenu('add-folder', item); close(); }}>
                          <FolderPlus className="w-4 h-4" /> Add Subfolder
                        </DropdownItem>
                        <div className="border-t border-neutral-100 dark:border-neutral-800 my-1" />
                      </>
                    )}
                    <DropdownItem onClick={() => { onContextMenu('rename', item); close(); }}>
                      <Pencil className="w-4 h-4" /> Rename
                    </DropdownItem>
                    <DropdownItem onClick={() => { onContextMenu('duplicate', item); close(); }}>
                      <Copy className="w-4 h-4" /> Duplicate
                    </DropdownItem>
                    <DropdownItem onClick={() => { close(); onContextMenu('move', item); }}>
                      <FolderInput className="w-4 h-4" /> Move to…
                    </DropdownItem>
                    <DropdownItem danger onClick={() => { onContextMenu('delete', item); close(); }}>
                      <Trash2 className="w-4 h-4" /> Move to Trash
                    </DropdownItem>
                  </>
                )}
              </Dropdown>
            </div>
          </div>
          {isExpanded && visibleChildren.length > 0 && (
            <div role="group" aria-label={name}>
              <SortableContext
                id={groupIdFor(item.id)}
                items={visibleChildren.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {visibleChildren.map((child) => (
                  <TreeItem
                    key={child.id}
                    item={child}
                    level={level + 1}
                    childrenByParent={childrenByParent}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    expandedIds={expandedIds}
                    toggleExpanded={toggleExpanded}
                    onContextMenu={onContextMenu}
                    searchVisibleIds={searchVisibleIds}
                  />
                ))}
              </SortableContext>
            </div>
          )}
        </>
      )}
    </SortableItem>
  );
}

function QuickLink({ icon, label, isSelected, iconOnly, onClick }) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isSelected ? 'page' : undefined}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={`w-full flex items-center ${iconOnly ? 'justify-center p-3' : 'gap-2 px-3 py-2.5'} mb-0.5 ${ROW_BASE} ${
        isSelected ? ROW_SELECTED : ROW_IDLE
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!iconOnly && <span className="text-sm">{label}</span>}
    </button>
  );
}

export default function Sidebar({ selectedId, onSelect, onOpenSettings }) {
  const { isOpen, isCollapsed, close, isMobile, effectiveWidth, isResizing, startResizing, toggleCollapsed } = useSidebar();
  const { logout, isDemo } = useAuth();
  const { sections, addSection, updateSection, deleteSection, duplicateSection, reorderSections, moveSection } = useFirestore();
  const { einkMode, toggleEinkMode } = useEink();
  const { focusMode } = useFocusMode();
  const { theme, preference: themePreference, setTheme, toggle: toggleTheme, isDarkSuppressed } = useTheme();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [modalState, setModalState] = useState({ type: null, item: null });
  const [newItemName, setNewItemName] = useState('');
  const [moveItem, setMoveItem] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const hoverExpand = useRef({ id: null, timer: null });

  useEffect(() => () => clearTimeout(hoverExpand.current.timer), []);

  const iconOnly = isCollapsed && !isMobile;
  const isVisible = isOpen && !focusMode;
  const darkChosen = theme === 'dark';

  const sensors = useTouchFriendlySensors({ coordinateGetter: siblingKeyboardCoordinates, keyboardCodes: KEYBOARD_CODES });

  // parentId -> children sorted by order
  const childrenByParent = useMemo(() => {
    const map = new Map();
    for (const s of sections) {
      const key = s.parentId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    for (const list of map.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return map;
  }, [sections]);

  const rootSections = useMemo(() => childrenByParent.get(null) ?? [], [childrenByParent]);

  // While searching: ids of every item that matches or has a matching descendant
  const query = searchQuery.trim().toLowerCase();
  const searchVisibleIds = useMemo(() => {
    if (!query) return null;
    const visible = new Set();
    const seen = new Set();
    const visit = (parentId) => {
      let anyVisible = false;
      for (const child of childrenByParent.get(parentId) ?? []) {
        if (seen.has(child.id)) continue; // guard against malformed parent cycles
        seen.add(child.id);
        const descendantMatches = visit(child.id);
        const selfMatches = (child.name || '').toLowerCase().includes(query);
        if (selfMatches || descendantMatches) {
          visible.add(child.id);
          anyVisible = true;
        }
      }
      return anyVisible;
    };
    visit(null);
    return visible;
  }, [query, childrenByParent]);

  const visibleRootSections = searchVisibleIds
    ? rootSections.filter((s) => searchVisibleIds.has(s.id))
    : rootSections;

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

  const closeModal = () => setModalState({ type: null, item: null });

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
      case 'move':
        setMoveItem(item);
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
          columns: defaultBoardColumns(),
          tasks: [],
        }),
      };
      await addSection(newSection);
    } else if (modalState.type === 'add-child' && newItemName.trim()) {
      // Add child item inside a folder
      const siblings = childrenByParent.get(modalState.parentItem.id) ?? [];
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
    closeModal();
  };

  const collisionDetection = useMemo(() => createCollisionDetection(sections), [sections]);

  // Screen reader announcements with item names instead of internal ids
  const dragAccessibility = useMemo(() => {
    const nameOf = (id) => sections.find((s) => s.id === id)?.name || 'Untitled';
    const describeOver = (over) => {
      const overId = String(over.id);
      if (overId === ROOT_ZONE) return 'the top level';
      if (overId.startsWith(INTO_PREFIX)) return `inside folder ${nameOf(overId.slice(INTO_PREFIX.length))}`;
      return `the position of ${nameOf(over.id)}`;
    };
    return {
      announcements: {
        onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
        onDragOver: ({ active, over }) => (over
          ? `${nameOf(active.id)} is over ${describeOver(over)}.`
          : `${nameOf(active.id)} is not over a drop target.`),
        onDragEnd: ({ active, over }) => (over
          ? `${nameOf(active.id)} was dropped at ${describeOver(over)}.`
          : `${nameOf(active.id)} was dropped.`),
        onDragCancel: ({ active }) => `Dragging was cancelled. ${nameOf(active.id)} was not moved.`,
      },
    };
  }, [sections]);

  const clearHoverExpand = () => {
    clearTimeout(hoverExpand.current.timer);
    hoverExpand.current = { id: null, timer: null };
  };

  // Hovering a collapsed folder while dragging opens it after a moment
  const handleDragOver = ({ over }) => {
    const overId = over ? String(over.id) : '';
    const folderId = overId.startsWith(INTO_PREFIX) ? overId.slice(INTO_PREFIX.length) : null;
    if (hoverExpand.current.id === folderId) return;
    clearHoverExpand();
    if (!folderId || expandedIds.has(folderId)) return;
    hoverExpand.current = {
      id: folderId,
      timer: setTimeout(() => {
        setExpandedIds((prev) => new Set([...prev, folderId]));
      }, HOVER_EXPAND_MS),
    };
  };

  const handleDragCancel = () => {
    clearHoverExpand();
    setDraggingId(null);
  };

  // Drop inside a folder / on the top-level zone moves; otherwise reorder
  // within the sibling group (same parentId)
  const handleDragEnd = ({ active, over }) => {
    clearHoverExpand();
    setDraggingId(null);
    if (!over || active.id === over.id) return;

    const overId = String(over.id);
    if (overId === ROOT_ZONE) {
      moveSection(active.id, null);
      return;
    }
    if (overId.startsWith(INTO_PREFIX)) {
      const folderId = overId.slice(INTO_PREFIX.length);
      moveSection(active.id, folderId);
      setExpandedIds((prev) => new Set([...prev, folderId]));
      return;
    }

    const activeItem = sections.find((s) => s.id === active.id);
    const overItem = sections.find((s) => s.id === over.id);
    if (!activeItem || !overItem) return;

    const parentId = activeItem.parentId ?? null;
    if ((overItem.parentId ?? null) !== parentId) return;

    const siblings = childrenByParent.get(parentId) ?? [];
    const oldIndex = siblings.findIndex((s) => s.id === active.id);
    const newIndex = siblings.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    reorderSections(arrayMove(siblings, oldIndex, newIndex));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarClasses = isMobile
    ? `fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transform transition-transform duration-200 ${
        isVisible ? 'translate-x-0' : '-translate-x-full'
      }`
    : `bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex-shrink-0 relative transition-all duration-200 ${isVisible ? '' : 'hidden'}`;

  const sidebarStyle = isMobile ? {} : { width: `${effectiveWidth}px` };

  const dividerClass = 'border-neutral-100 dark:border-neutral-800';

  return (
    <>
      {isMobile && isVisible && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/60 z-40"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={sidebarClasses}
        style={sidebarStyle}
        aria-label="Sidebar"
        // Off-screen drawer shouldn't be reachable with Tab
        inert={isMobile && !isVisible ? true : undefined}
      >
        {/* Resize handle - only on desktop when expanded */}
        {!isMobile && isOpen && !isCollapsed && (
          <div
            onMouseDown={startResizing}
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors ${
              isResizing ? 'bg-neutral-400 dark:bg-neutral-600' : 'bg-transparent'
            }`}
          />
        )}
        <div className="flex flex-col h-full">
          {/* Logo - serif typography, no icon badge */}
          <div className={`border-b ${dividerClass} ${iconOnly ? 'p-3' : 'p-4 sm:p-5'}`}>
            <div className="flex items-center justify-between">
              {iconOnly ? (
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="w-full flex items-center justify-center p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <h1 className="font-serif text-lg sm:text-xl font-medium text-neutral-900 dark:text-neutral-100 tracking-tight truncate">Thinking Space</h1>
                    <p className="text-xs sm:text-sm text-neutral-400 dark:text-neutral-500 mt-0.5">Your Workspace</p>
                  </div>
                  {isMobile ? (
                    <button
                      type="button"
                      onClick={close}
                      aria-label="Close sidebar"
                      title="Close sidebar"
                      className={`p-2 flex-shrink-0 rounded-lg ${FOOTER_TEXT_BUTTON}`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={toggleCollapsed}
                      className={`p-2 flex-shrink-0 rounded-lg ${FOOTER_TEXT_BUTTON}`}
                      title="Collapse sidebar"
                      aria-label="Collapse sidebar"
                    >
                      <ChevronDown className="w-4 h-4 rotate-90" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Search - minimal styling (hidden when collapsed) */}
          {!iconOnly && (
            <div className="p-3 sm:p-4">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && searchQuery) {
                      e.stopPropagation();
                      setSearchQuery('');
                    }
                  }}
                  placeholder="Search..."
                  aria-label="Search notes, boards and folders"
                  className={`${INPUT_CLASS} pl-10 pr-4`}
                />
              </div>
            </div>
          )}

          {/* Quick Navigation */}
          <div className={`border-b ${dividerClass} mb-3 ${iconOnly ? 'px-2 pb-3' : 'px-3 pb-3'}`}>
            <QuickLink icon={Home} label="Dashboard" iconOnly={iconOnly} isSelected={selectedId == null} onClick={() => onSelect(null)} />
            <QuickLink
              icon={CalendarDays}
              label="Calendar"
              iconOnly={iconOnly}
              isSelected={selectedId === 'calendar'}
              onClick={() => onSelect({ id: 'calendar', type: 'calendar', name: 'Calendar' })}
            />
            <QuickLink
              icon={BookMarked}
              label="Reading List"
              iconOnly={iconOnly}
              isSelected={selectedId === 'reading-list'}
              onClick={() => onSelect({ id: 'reading-list', type: 'reading-list', name: 'Reading List' })}
            />
            <QuickLink
              icon={ClipboardList}
              label="Weekly Review"
              iconOnly={iconOnly}
              isSelected={selectedId === 'review'}
              onClick={() => onSelect({ id: 'review', type: 'review', name: 'Weekly Review' })}
            />
            <QuickLink
              icon={Tag}
              label="Tags"
              iconOnly={iconOnly}
              isSelected={selectedId === 'tags'}
              onClick={() => onSelect({ id: 'tags', type: 'tags', name: 'Tags' })}
            />
          </div>

          {/* Navigation Tree - collapsed shows icons only */}
          <nav aria-label="Sections" className={`flex-1 min-h-0 overflow-y-auto ${iconOnly ? 'px-2' : 'px-3'}`}>
            {iconOnly ? (
              // Collapsed view - show icons only
              <div className="space-y-1">
                {rootSections.map((section) => (
                  <QuickLink
                    key={section.id}
                    icon={getIcon(section.icon)}
                    label={section.name || 'Untitled'}
                    iconOnly
                    isSelected={selectedId === section.id}
                    onClick={() => onSelect(section)}
                  />
                ))}
              </div>
            ) : (
              // Expanded view - full tree
              <DndContext
                sensors={sensors}
                collisionDetection={collisionDetection}
                accessibility={dragAccessibility}
                // Folders opened mid-drag and the top-level zone need measuring too
                measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                onDragStart={({ active }) => setDraggingId(active.id)}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext
                  id={groupIdFor(null)}
                  items={visibleRootSections.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {visibleRootSections.map((section) => (
                    <TreeItem
                      key={section.id}
                      item={section}
                      childrenByParent={childrenByParent}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      expandedIds={expandedIds}
                      toggleExpanded={toggleExpanded}
                      onContextMenu={handleContextMenu}
                      searchVisibleIds={searchVisibleIds}
                    />
                  ))}
                </SortableContext>
                {draggingId && (sections.find((s) => s.id === draggingId)?.parentId ?? null) !== null && <RootDropZone />}
                {searchVisibleIds && visibleRootSections.length === 0 && (
                  <p className="px-3 py-4 text-sm text-neutral-400 dark:text-neutral-500" role="status">
                    No matches for “{searchQuery.trim()}”
                  </p>
                )}
              </DndContext>
            )}
          </nav>

          {/* Add section - simple text button */}
          <div className={`flex-shrink-0 border-t ${dividerClass} ${iconOnly ? 'p-2' : 'p-3 sm:p-4'}`}>
            <button
              type="button"
              onClick={() => handleAddSection('folder')}
              className={`w-full flex items-center ${FOOTER_TEXT_BUTTON} ${
                iconOnly ? 'justify-center p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800' : 'gap-2 text-left text-sm'
              }`}
              title={iconOnly ? 'Add section' : undefined}
              aria-label={iconOnly ? 'Add section' : undefined}
            >
              <Plus size={18} />
              {!iconOnly && <span>Add section</span>}
            </button>
          </div>

          {/* User & Logout */}
          <div className={`flex-shrink-0 border-t ${dividerClass} ${iconOnly ? 'p-2 space-y-1' : 'p-3 sm:p-4 space-y-2'}`}>
            {/* Demo mode banner */}
            {isDemo && !iconOnly && (
              <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 rounded-lg p-3 mb-2">
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Demo Mode</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Changes are stored locally only</p>
              </div>
            )}
            <div className={iconOnly ? 'space-y-1' : 'flex items-center gap-4'}>
              <button
                type="button"
                onClick={onOpenSettings}
                className={`flex items-center ${FOOTER_TEXT_BUTTON} ${iconOnly ? 'w-full justify-center p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800' : 'gap-2 text-sm'}`}
                title={iconOnly ? 'Settings' : 'Appearance, backup and more'}
                aria-label={iconOnly ? 'Settings' : undefined}
              >
                <Settings size={16} aria-hidden="true" />
                {!iconOnly && <span>Settings</span>}
              </button>
              <button
                type="button"
                onClick={() => onSelect({ id: 'trash', type: 'trash', name: 'Trash' })}
                aria-current={selectedId === 'trash' ? 'page' : undefined}
                className={`flex items-center ${FOOTER_TEXT_BUTTON} ${iconOnly ? 'w-full justify-center p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800' : 'gap-2 text-sm'}`}
                title={iconOnly ? 'Trash' : 'Recently deleted items'}
                aria-label={iconOnly ? 'Trash' : undefined}
              >
                <Trash2 size={16} aria-hidden="true" />
                {!iconOnly && <span>Trash</span>}
              </button>
            </div>
            {/* Dark mode toggle (+ way back to following the system setting) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className={`flex-1 min-w-0 flex items-center ${FOOTER_TEXT_BUTTON} ${
                  iconOnly ? 'justify-center p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800' : 'justify-between text-left text-sm'
                }`}
                title={iconOnly ? `Dark mode: ${darkChosen ? 'On' : 'Off'}` : undefined}
                aria-label={iconOnly ? 'Dark mode' : undefined}
                aria-pressed={darkChosen}
              >
                <span className="flex items-center gap-2">
                  {darkChosen ? <Moon size={16} className="text-neutral-700 dark:text-neutral-200" /> : <Sun size={16} />}
                  {!iconOnly && <span>Dark mode</span>}
                </span>
                {!iconOnly && (
                  <span className={`text-xs ${darkChosen ? 'text-neutral-900 dark:text-neutral-100 font-medium' : 'text-neutral-400 dark:text-neutral-500'}`}>
                    {isDarkSuppressed ? 'Paused' : darkChosen ? 'On' : 'Off'}
                  </span>
                )}
              </button>
              {!iconOnly && themePreference !== 'system' && (
                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={`text-xs flex-shrink-0 ${FOOTER_TEXT_BUTTON}`}
                  title="Follow the system light/dark setting"
                >
                  Auto
                </button>
              )}
            </div>
            {/* E-ink mode toggle */}
            <button
              type="button"
              onClick={toggleEinkMode}
              className={`w-full flex items-center ${FOOTER_TEXT_BUTTON} ${
                iconOnly ? 'justify-center p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800' : 'justify-between text-left text-sm'
              }`}
              title={iconOnly ? `E-reader mode: ${einkMode ? 'On' : 'Off'}` : 'High-contrast light theme for e-ink displays'}
              aria-label={iconOnly ? 'E-reader mode' : undefined}
              aria-pressed={einkMode}
            >
              <span className="flex items-center gap-2">
                <Monitor size={16} className={einkMode ? 'text-neutral-900 dark:text-neutral-100' : ''} />
                {!iconOnly && <span>E-reader mode</span>}
              </span>
              {!iconOnly && (
                <span className={`text-xs ${einkMode ? 'text-neutral-900 dark:text-neutral-100 font-medium' : 'text-neutral-400 dark:text-neutral-500'}`}>
                  {einkMode ? 'On' : 'Off'}
                </span>
              )}
            </button>
            {isDemo ? (
              <button
                type="button"
                onClick={handleLogout}
                className={`w-full flex items-center rounded-lg transition-colors text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 dark:text-neutral-200 dark:hover:text-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-700 ${
                  iconOnly ? 'justify-center p-3' : 'gap-2 text-left text-sm px-3 py-2'
                }`}
                title={iconOnly ? 'Sign up' : undefined}
                aria-label={iconOnly ? 'Sign up to save' : undefined}
              >
                <UserPlus size={18} />
                {!iconOnly && <span>Sign up to save</span>}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className={`w-full flex items-center text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400 transition-colors ${
                  iconOnly ? 'justify-center p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800' : 'gap-2 text-left text-sm'
                }`}
                title={iconOnly ? 'Sign out' : undefined}
                aria-label={iconOnly ? 'Sign out' : undefined}
              >
                <LogOut size={18} />
                {!iconOnly && <span>Sign out</span>}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Add/Rename Modal */}
      <Modal
        isOpen={modalState.type === 'add' || modalState.type === 'add-child' || modalState.type === 'rename'}
        onClose={closeModal}
        title={
          modalState.type === 'add'
            ? `New ${modalState.itemType}`
            : modalState.type === 'add-child'
            ? `New ${modalState.itemType} in "${modalState.parentItem?.name}"`
            : 'Rename'
        }
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleModalSubmit();
          }}
        >
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Enter name..."
            aria-label="Name"
            autoFocus
            className={INPUT_CLASS}
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newItemName.trim()}>
              {modalState.type === 'add' || modalState.type === 'add-child' ? 'Create' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={modalState.type === 'delete'}
        onClose={closeModal}
        title="Move to Trash"
        size="sm"
      >
        {(() => {
          const target = modalState.item;
          if (!target) return null;
          const descendantCount = subtreeIds(sections, target.id).length - 1;
          return (
            <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Move "{target.name}" to Trash?
              {descendantCount > 0 && (
                <>
                  {' '}The{' '}
                  <strong className="font-medium text-neutral-900 dark:text-neutral-100">{descendantCount} {descendantCount === 1 ? 'item' : 'items'}</strong>
                  {' '}inside it (notes, boards, sub-folders) will move too.
                </>
              )}
              {' '}You can restore {descendantCount > 0 ? 'them' : 'it'} from Trash for 30 days.
            </p>
          );
        })()}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button onClick={handleModalSubmit} autoFocus>
            Move to Trash
          </Button>
        </div>
      </Modal>

      <MoveToModal isOpen={Boolean(moveItem)} item={moveItem} onClose={() => setMoveItem(null)} />
    </>
  );
}
