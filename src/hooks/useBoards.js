import { useCallback, useMemo } from 'react';
import { useFirestore } from './useFirestore';

// Every board operation is an updater of the latest stored board (see
// SectionsProvider.mutateSection), so edits from other tabs/devices made since
// this screen last rendered are never overwritten by a stale copy.

const newId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

// Same rule the calendar and dashboard use to treat a task as finished
export function isDoneColumn(column) {
  const name = column?.name?.toLowerCase() || '';
  return name.includes('done') || name.includes('complete');
}

// Tasks of one column in display order (stable for equal `order` values)
export function columnTasks(tasks, columnId) {
  return tasks.filter((t) => t.columnId === columnId).sort(byOrder);
}

// Moves a task to `toIndex` within `toColumnId` (arrayMove semantics: the index
// is the task's final position in that column) and renumbers `order` 0..n-1 in
// both the source and destination columns. Returns the input when nothing moves.
export function applyTaskMove(tasks, taskId, toColumnId, toIndex) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return tasks;

  const dest = columnTasks(tasks, toColumnId).filter((t) => t.id !== taskId);
  const index = Math.max(0, Math.min(toIndex ?? dest.length, dest.length));
  dest.splice(index, 0, task);

  const orders = new Map(dest.map((t, i) => [t.id, i]));
  if (task.columnId !== toColumnId) {
    columnTasks(tasks, task.columnId)
      .filter((t) => t.id !== taskId)
      .forEach((t, i) => orders.set(t.id, i));
  }

  let changed = false;
  const next = tasks.map((t) => {
    if (!orders.has(t.id)) return t;
    const order = orders.get(t.id);
    const columnId = t.id === taskId ? toColumnId : t.columnId;
    if (t.order === order && t.columnId === columnId) return t;
    changed = true;
    return { ...t, columnId, order };
  });
  return changed ? next : tasks;
}

// Stamps `completedAt` (ISO string) on tasks that moved into a done column and
// removes it from tasks that moved out of one. `before` is the task list prior
// to the change; tasks whose column didn't change are returned untouched.
export function stampCompletion(columns, before, after) {
  if (after === before) return after;
  const done = new Set(columns.filter(isDoneColumn).map((c) => c.id));
  const previousColumn = new Map(before.map((t) => [t.id, t.columnId]));
  const now = new Date().toISOString();
  let changed = false;
  const next = after.map((task) => {
    const wasIn = previousColumn.get(task.id);
    if (wasIn === task.columnId) return task;
    const wasDone = wasIn !== undefined && done.has(wasIn);
    const isDone = done.has(task.columnId);
    if (isDone && !wasDone && !task.completedAt) {
      changed = true;
      return { ...task, completedAt: now };
    }
    if (!isDone && 'completedAt' in task) {
      changed = true;
      const { completedAt: _completedAt, ...rest } = task;
      return rest;
    }
    return task;
  });
  return changed ? next : after;
}

export function useBoards(boardId) {
  const { mutateSection } = useFirestore();

  const mutateBoard = useCallback((updater) => {
    if (!boardId) return Promise.resolve();
    return mutateSection(boardId, (board) => updater({
      columns: board.columns || [],
      tasks: board.tasks || [],
    }));
  }, [boardId, mutateSection]);

  const addColumn = useCallback(async (columnName) => {
    const id = newId('col');
    await mutateBoard(({ columns }) => ({
      columns: [
        ...columns,
        { id, name: columnName, order: columns.reduce((max, c) => Math.max(max, c.order ?? 0), -1) + 1 },
      ],
    }));
    return id;
  }, [mutateBoard]);

  const updateColumn = useCallback((columnId, updates) => {
    const { id: _id, ...changes } = updates;
    return mutateBoard(({ columns }) => ({
      columns: columns.map((col) => (col.id === columnId ? { ...col, ...changes } : col)),
    }));
  }, [mutateBoard]);

  const deleteColumn = useCallback((columnId) => {
    return mutateBoard(({ columns, tasks }) => ({
      columns: columns.filter((col) => col.id !== columnId),
      tasks: tasks.filter((task) => task.columnId !== columnId),
    }));
  }, [mutateBoard]);

  // orderedIds: column ids in their new order; columns not listed keep their
  // relative order after them.
  const reorderColumns = useCallback((orderedIds) => {
    return mutateBoard(({ columns }) => {
      const rank = new Map(orderedIds.map((id, i) => [id, i]));
      const sorted = [...columns].sort((a, b) => {
        const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
        const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
        return ra === rb ? byOrder(a, b) : ra - rb;
      });
      return { columns: sorted.map((col, order) => ({ ...col, order })) };
    });
  }, [mutateBoard]);

  const addTask = useCallback(async (taskData) => {
    const id = newId('task');
    await mutateBoard(({ columns, tasks }) => {
      if (!columns.some((c) => c.id === taskData.columnId)) return {};
      const order = columnTasks(tasks, taskData.columnId)
        .reduce((max, t) => Math.max(max, t.order ?? 0), -1) + 1;
      return {
        tasks: stampCompletion(columns, tasks, [...tasks, {
          id,
          title: taskData.title,
          description: taskData.description || '',
          columnId: taskData.columnId,
          priority: taskData.priority || 'medium',
          tags: taskData.tags || [],
          dueDate: taskData.dueDate || null,
          order,
        }]),
      };
    });
    return id;
  }, [mutateBoard]);

  // Edits a task's fields. Position (order) is owned by moveTask; a columnId
  // change moves the task to the end of that column.
  const updateTask = useCallback((taskId, updates) => {
    const { id: _id, order: _order, columnId, ...changes } = updates;
    if ('dueDate' in changes) changes.dueDate = changes.dueDate || null;
    return mutateBoard(({ columns, tasks }) => {
      let next = tasks.map((task) => (task.id === taskId ? { ...task, ...changes } : task));
      const task = next.find((t) => t.id === taskId);
      if (task && columnId && columnId !== task.columnId && columns.some((c) => c.id === columnId)) {
        next = applyTaskMove(next, taskId, columnId, Infinity);
      }
      return { tasks: stampCompletion(columns, tasks, next) };
    });
  }, [mutateBoard]);

  const deleteTask = useCallback((taskId) => {
    return mutateBoard(({ tasks }) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return {};
      const remaining = tasks.filter((t) => t.id !== taskId);
      const orders = new Map(columnTasks(remaining, task.columnId).map((t, i) => [t.id, i]));
      return {
        tasks: remaining.map((t) => (orders.has(t.id) && t.order !== orders.get(t.id) ? { ...t, order: orders.get(t.id) } : t)),
      };
    });
  }, [mutateBoard]);

  // Places a task at `toIndex` in `toColumnId` (its final position there)
  const moveTask = useCallback((taskId, toColumnId, toIndex) => {
    return mutateBoard(({ columns, tasks }) => {
      if (!columns.some((c) => c.id === toColumnId)) return {};
      const next = applyTaskMove(tasks, taskId, toColumnId, toIndex);
      return next === tasks ? {} : { tasks: stampCompletion(columns, tasks, next) };
    });
  }, [mutateBoard]);

  // Renumbers one column from the given task-id order (e.g. after a bulk sort);
  // tasks not listed keep their relative order after them.
  const reorderTasks = useCallback((columnId, orderedTaskIds) => {
    return mutateBoard(({ tasks }) => {
      const rank = new Map(orderedTaskIds.map((id, i) => [id, i]));
      const inColumn = columnTasks(tasks, columnId).sort((a, b) => {
        const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
        const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
        return ra === rb ? byOrder(a, b) : ra - rb;
      });
      const orders = new Map(inColumn.map((t, i) => [t.id, i]));
      return {
        tasks: tasks.map((t) => (orders.has(t.id) && t.order !== orders.get(t.id) ? { ...t, order: orders.get(t.id) } : t)),
      };
    });
  }, [mutateBoard]);

  return useMemo(() => ({
    addColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderTasks,
  }), [addColumn, updateColumn, deleteColumn, reorderColumns, addTask, updateTask, deleteTask, moveTask, reorderTasks]);
}
