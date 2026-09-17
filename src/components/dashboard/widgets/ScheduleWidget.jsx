import { useState } from 'react';
import { Plus, Trash2, Pencil, X, Check, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import WidgetHeader from './WidgetHeader';
import {
  inputClass,
  inlineInputClass,
  primaryTextButton,
  secondaryTextButton,
  linkButton,
  iconButton,
  dangerIconButton,
  rowHoverClass,
} from './styles';

const EMPTY_BLOCK = { title: '', startTime: '09:00', endTime: '10:00' };

const parseTime = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const nowBadge = <span className="text-xs sm:text-sm text-rose-500 font-medium uppercase flex-shrink-0">Now</span>;

export default function ScheduleWidget({ currentTime, blocks = [], events = [], onOpenCalendar, onAddBlock, onUpdateBlock, onDeleteBlock }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newBlock, setNewBlock] = useState(EMPTY_BLOCK);
  const [editingId, setEditingId] = useState(null);
  const [editBlock, setEditBlock] = useState(EMPTY_BLOCK);

  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  // Daily blocks repeat every day; calendar events are today's one-offs (read-only here).
  const sortedBlocks = [
    ...blocks,
    ...events.map(e => ({ ...e, isCalendar: true, endTime: e.endTime || e.startTime })),
  ].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
  const currentBlock = sortedBlocks.find(b => currentMinutes >= parseTime(b.startTime) && currentMinutes < parseTime(b.endTime));

  const handleAdd = () => {
    if (newBlock.title && newBlock.startTime && newBlock.endTime) {
      onAddBlock?.({ ...newBlock });
      setNewBlock(EMPTY_BLOCK);
      setIsAdding(false);
    }
  };

  return (
    <>
      <WidgetHeader title="Today's Schedule" addLabel="Add time block" onAdd={() => setIsAdding(true)} />
      <div className="flex-1 overflow-y-auto">
        {/* Current time display */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" aria-hidden="true" />
            <span className="font-serif text-4xl sm:text-5xl font-medium text-neutral-900 dark:text-neutral-100 tabular-nums tracking-tight">
              {format(currentTime, 'HH:mm')}
            </span>
          </div>
          {currentBlock && <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400 mt-2">{currentBlock.title}</p>}
        </div>

        {isAdding && (
          <div className="p-4 sm:p-6 border-b border-neutral-100 dark:border-neutral-800 space-y-3">
            <input
              type="text"
              placeholder="Task name"
              aria-label="Task name"
              value={newBlock.title}
              onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })}
              className={inputClass}
              autoFocus
            />
            <div className="flex gap-2">
              <input
                type="time"
                aria-label="Start time"
                value={newBlock.startTime}
                onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })}
                className={inlineInputClass}
              />
              <input
                type="time"
                aria-label="End time"
                value={newBlock.endTime}
                onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })}
                className={inlineInputClass}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAdd} disabled={!newBlock.title} className={primaryTextButton}>Add</button>
              <button type="button" onClick={() => setIsAdding(false)} className={secondaryTextButton}>Cancel</button>
            </div>
          </div>
        )}

        {sortedBlocks.length === 0 && !isAdding ? (
          <div className="p-4 sm:p-6">
            <button type="button" onClick={() => setIsAdding(true)} className={`text-base flex items-center gap-2 ${linkButton}`}>
              <Plus size={16} aria-hidden="true" /> Add time block
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {sortedBlocks.map((block) => {
              const isPast = parseTime(block.endTime) < currentMinutes;
              const isCurrent = block.id === currentBlock?.id;
              const timeClass = `text-base sm:text-lg tabular-nums flex-shrink-0 ${isCurrent ? 'text-neutral-900 dark:text-neutral-100 font-medium' : 'text-neutral-400'}`;
              const titleClass = `flex-1 text-base sm:text-lg ${isCurrent ? 'text-neutral-900 dark:text-neutral-100 font-medium' : 'text-neutral-600 dark:text-neutral-300'}`;

              if (block.isCalendar) {
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={onOpenCalendar}
                    title="Open in calendar"
                    className={`w-full text-left px-4 sm:px-6 py-3 sm:py-4 flex items-start gap-3 sm:gap-5 ${rowHoverClass} transition-colors focus:outline-none focus-visible:bg-neutral-50 dark:focus-visible:bg-neutral-800/40 ${isPast ? 'opacity-40' : ''} ${isCurrent ? 'bg-neutral-50 dark:bg-neutral-800/40' : ''}`}
                  >
                    <span className={timeClass}>{block.startTime}</span>
                    <span className={titleClass}>{block.title}</span>
                    <span className="flex items-center gap-2 pt-1">
                      <CalendarDays size={14} className="text-neutral-300 dark:text-neutral-600" aria-label="Calendar event" />
                      {isCurrent && nowBadge}
                    </span>
                  </button>
                );
              }

              if (editingId === block.id) {
                return (
                  <div key={block.id} className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editBlock.title}
                        onChange={(e) => setEditBlock({ ...editBlock, title: e.target.value })}
                        placeholder="Task name"
                        aria-label="Task name"
                        className={inputClass}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <input
                          type="time"
                          aria-label="Start time"
                          value={editBlock.startTime}
                          onChange={(e) => setEditBlock({ ...editBlock, startTime: e.target.value })}
                          className={inlineInputClass}
                        />
                        <input
                          type="time"
                          aria-label="End time"
                          value={editBlock.endTime}
                          onChange={(e) => setEditBlock({ ...editBlock, endTime: e.target.value })}
                          className={inlineInputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!editBlock.title.trim()) return;
                            onUpdateBlock?.(block.id, {
                              title: editBlock.title.trim(),
                              startTime: editBlock.startTime,
                              endTime: editBlock.endTime,
                            });
                            setEditingId(null);
                          }}
                          className={primaryTextButton}
                        >
                          <Check size={16} className="inline mr-2" aria-hidden="true" />
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className={secondaryTextButton}>
                          <X size={16} className="inline mr-2" aria-hidden="true" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={block.id} className={`px-4 sm:px-6 py-3 sm:py-4 flex items-start gap-3 sm:gap-5 ${isPast ? 'opacity-40' : ''} ${isCurrent ? 'bg-neutral-50 dark:bg-neutral-800/40' : ''}`}>
                  <span className={timeClass}>{block.startTime}</span>
                  <p className={titleClass}>{block.title}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(block.id);
                        setEditBlock({ title: block.title, startTime: block.startTime, endTime: block.endTime });
                      }}
                      className={iconButton}
                      title="Edit"
                      aria-label={`Edit "${block.title}"`}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBlock?.(block.id)}
                      className={dangerIconButton}
                      title="Delete"
                      aria-label={`Delete "${block.title}"`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                    {isCurrent && nowBadge}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
