import { useCallback } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export function useBoards(boardId) {
  const { user } = useAuth();

  const updateBoard = useCallback(async (updates) => {
    if (!user || !boardId) return;

    const boardRef = doc(db, 'users', user.uid, 'sections', boardId);
    await updateDoc(boardRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }, [user, boardId]);

  const addColumn = useCallback(async (columns, columnName) => {
    const newColumn = {
      id: `col-${Date.now()}`,
      name: columnName,
      order: columns.length,
    };
    await updateBoard({ columns: [...columns, newColumn] });
    return newColumn;
  }, [updateBoard]);

  const updateColumn = useCallback(async (columns, columnId, updates) => {
    const updatedColumns = columns.map(col =>
      col.id === columnId ? { ...col, ...updates } : col
    );
    await updateBoard({ columns: updatedColumns });
  }, [updateBoard]);

  const deleteColumn = useCallback(async (columns, tasks, columnId) => {
    const updatedColumns = columns.filter(col => col.id !== columnId);
    const updatedTasks = tasks.filter(task => task.columnId !== columnId);
    await updateBoard({ columns: updatedColumns, tasks: updatedTasks });
  }, [updateBoard]);

  const reorderColumns = useCallback(async (columns) => {
    const reorderedColumns = columns.map((col, index) => ({
      ...col,
      order: index,
    }));
    await updateBoard({ columns: reorderedColumns });
  }, [updateBoard]);

  const addTask = useCallback(async (tasks, taskData) => {
    const newTask = {
      id: `task-${Date.now()}`,
      title: taskData.title,
      description: taskData.description || '',
      columnId: taskData.columnId,
      priority: taskData.priority || 'medium',
      tags: taskData.tags || [],
      dueDate: taskData.dueDate || null,
      order: tasks.filter(t => t.columnId === taskData.columnId).length,
    };
    await updateBoard({ tasks: [...tasks, newTask] });
    return newTask;
  }, [updateBoard]);

  const updateTask = useCallback(async (tasks, taskId, updates) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    );
    await updateBoard({ tasks: updatedTasks });
  }, [updateBoard]);

  const deleteTask = useCallback(async (tasks, taskId) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    await updateBoard({ tasks: updatedTasks });
  }, [updateBoard]);

  const moveTask = useCallback(async (tasks, taskId, newColumnId, newOrder) => {
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        return { ...task, columnId: newColumnId, order: newOrder };
      }
      return task;
    });
    await updateBoard({ tasks: updatedTasks });
  }, [updateBoard]);

  const reorderTasks = useCallback(async (tasks) => {
    await updateBoard({ tasks });
  }, [updateBoard]);

  return {
    addColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderTasks,
  };
}
