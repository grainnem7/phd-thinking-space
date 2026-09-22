import { useId, useState } from 'react';
import Modal from '../common/Modal';
import { TaskForm } from '../board/TaskModal';
import { useBoards } from '../../hooks/useBoards';

const LAST_BOARD_KEY = 'quick-add-board';

function readLastBoard() {
  try {
    return localStorage.getItem(LAST_BOARD_KEY);
  } catch {
    return null;
  }
}

function writeLastBoard(id) {
  try {
    localStorage.setItem(LAST_BOARD_KEY, id);
  } catch {
    /* storage unavailable: the choice isn't remembered */
  }
}

const firstColumnOf = (board) => [...(board?.columns || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];

// A new task from the phone's Add sheet: pick a board; the task goes into its first column
export default function QuickTaskModal({ boards, onClose }) {
  const id = useId();
  const [boardId, setBoardId] = useState(() => {
    const saved = readLastBoard();
    return boards.some((b) => b.id === saved) ? saved : boards[0]?.id;
  });
  const board = boards.find((b) => b.id === boardId);
  const { addTask } = useBoards(boardId);

  const handleSave = (task) => {
    writeLastBoard(boardId);
    addTask(task);
  };

  return (
    <Modal isOpen onClose={onClose} title="New task">
      <div className="mb-4">
        <label htmlFor={`${id}-board`} className="block mb-2 text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-medium">Board</label>
        <select
          id={`${id}-board`}
          value={boardId}
          onChange={(e) => setBoardId(e.target.value)}
          className="w-full px-3 py-2.5 text-base bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 text-neutral-900 dark:text-neutral-100"
        >
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name || 'Untitled Board'}</option>)}
        </select>
      </div>
      <TaskForm key={boardId} columnId={firstColumnOf(board)?.id} onSave={handleSave} onClose={onClose} />
    </Modal>
  );
}
