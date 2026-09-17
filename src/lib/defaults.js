// Shared defaults for new accounts, boards and demo data.

export function defaultBoardColumns() {
  return [
    { id: 'todo', name: 'To Do', order: 0 },
    { id: 'in-progress', name: 'In Progress', order: 1 },
    { id: 'done', name: 'Done', order: 2 },
  ];
}

// Sections created for a brand-new account (or "Reset to defaults")
export function defaultSections() {
  return [
    { name: 'Notes', icon: 'folder', order: 0, parentId: null, type: 'folder' },
    { name: 'Tasks', icon: 'kanban', order: 1, parentId: null, type: 'board', columns: defaultBoardColumns(), tasks: [] },
  ];
}

// Firestore batches are capped at 500 writes; stay comfortably below.
export const BATCH_LIMIT = 400;
