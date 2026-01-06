import { ChevronRight } from 'lucide-react';
import WidgetWrapper from './WidgetWrapper';

export default function TaskSummaryWidget({ onRemove, boards = [], onNavigate }) {
  const counts = boards.reduce((acc, board) => {
    (board.columns || []).forEach((col) => {
      const n = col.cards?.length || 0;
      const name = col.name?.toLowerCase() || '';
      if (name.includes('done') || name.includes('complete')) acc.done += n;
      else if (name.includes('progress') || name.includes('doing')) acc.inProgress += n;
      else acc.todo += n;
      acc.total += n;
    });
    return acc;
  }, { todo: 0, inProgress: 0, done: 0, total: 0 });

  const pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  return (
    <WidgetWrapper title="Tasks" onRemove={onRemove}>
      {boards.length === 0 ? (
        <p className="text-sm text-neutral-400">No boards yet</p>
      ) : (
        <>
          {/* Large percentage display */}
          <div className="flex items-baseline gap-3 mb-6">
            <span className="font-serif text-5xl font-medium text-neutral-900 tabular-nums tracking-tight">
              {pct}%
            </span>
            <span className="text-sm text-neutral-400">complete</span>
          </div>

          {/* Simple stats row */}
          <div className="flex gap-6 mb-6 pb-6 border-b border-neutral-100">
            <div>
              <p className="text-2xl font-medium text-neutral-900 tabular-nums">{counts.todo}</p>
              <p className="text-xs text-neutral-400">To do</p>
            </div>
            <div>
              <p className="text-2xl font-medium text-neutral-900 tabular-nums">{counts.inProgress}</p>
              <p className="text-xs text-neutral-400">In progress</p>
            </div>
            <div>
              <p className="text-2xl font-medium text-neutral-900 tabular-nums">{counts.done}</p>
              <p className="text-xs text-neutral-400">Done</p>
            </div>
          </div>

          {/* Boards list */}
          <div className="divide-y divide-neutral-100">
            {boards.map((board) => {
              const taskCount = (board.columns || []).reduce((s, c) => s + (c.cards?.length || 0), 0);
              const doneCount = (board.columns || []).reduce((s, c) => {
                const n = c.name?.toLowerCase() || '';
                return (n.includes('done') || n.includes('complete')) ? s + (c.cards?.length || 0) : s;
              }, 0);
              const progress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
              return (
                <button
                  key={board.id}
                  onClick={() => onNavigate?.(board)}
                  className="w-full flex items-center gap-4 py-3 group text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-base text-neutral-900">{board.name}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{taskCount} tasks</p>
                  </div>
                  <span className="text-sm text-neutral-400 tabular-nums">{progress}%</span>
                  <ChevronRight size={16} className="text-neutral-300 group-hover:text-neutral-500 transition-colors" />
                </button>
              );
            })}
          </div>
        </>
      )}
    </WidgetWrapper>
  );
}
