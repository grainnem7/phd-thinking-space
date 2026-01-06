import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import WidgetWrapper from './WidgetWrapper';

const CATEGORIES = [
  { id: 'deep-work', label: 'Deep Work' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'break', label: 'Break' },
  { id: 'admin', label: 'Admin' },
  { id: 'reading', label: 'Reading' },
];

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(timeStr) {
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

export default function DailyScheduleWidget({ onRemove, blocks = [], onAddBlock, onDeleteBlock }) {
  const [isAdding, setIsAdding] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [newBlock, setNewBlock] = useState({ title: '', startTime: '09:00', endTime: '10:00', category: 'deep-work' });

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const sortedBlocks = [...blocks].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
  const currentBlock = sortedBlocks.find(b => currentMinutes >= parseTime(b.startTime) && currentMinutes < parseTime(b.endTime));
  const nextBlock = sortedBlocks.find(b => parseTime(b.startTime) > currentMinutes);

  const handleAdd = () => {
    if (newBlock.title && newBlock.startTime && newBlock.endTime) {
      onAddBlock?.({ ...newBlock });
      setNewBlock({ title: '', startTime: '09:00', endTime: '10:00', category: 'deep-work' });
      setIsAdding(false);
    }
  };

  const getCategoryInfo = (catId) => CATEGORIES.find(c => c.id === catId) || CATEGORIES[0];

  return (
    <WidgetWrapper
      title="Today's Schedule"
      onRemove={onRemove}
      actions={!isAdding && (
        <button onClick={() => setIsAdding(true)} className="text-neutral-300 hover:text-neutral-500 transition-colors">
          <Plus size={15} />
        </button>
      )}
    >
      {/* Large time display with NOW indicator */}
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        <span className="font-serif text-5xl font-medium text-neutral-900 tabular-nums tracking-tight">
          {format(currentTime, 'HH:mm')}
        </span>
      </div>

      {/* Current/next block indicator */}
      {currentBlock ? (
        <p className="text-sm text-neutral-600 mb-6">{currentBlock.title}</p>
      ) : nextBlock ? (
        <p className="text-sm text-neutral-400 mb-6">Next: {nextBlock.title}</p>
      ) : null}

      {/* Add form */}
      {isAdding && (
        <div className="mb-4 space-y-3">
          <input
            type="text"
            placeholder="Task name"
            value={newBlock.title}
            onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300"
            autoFocus
          />
          <div className="flex gap-2">
            <input type="time" value={newBlock.startTime} onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })}
              className="flex-1 px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300" />
            <input type="time" value={newBlock.endTime} onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })}
              className="flex-1 px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!newBlock.title}
              className="flex-1 py-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors disabled:text-neutral-300">Add</button>
            <button onClick={() => setIsAdding(false)} className="flex-1 py-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Time blocks */}
      {sortedBlocks.length === 0 && !isAdding ? (
        <button onClick={() => setIsAdding(true)} className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors flex items-center gap-2">
          <Plus size={15} />
          Add time block
        </button>
      ) : (
        <div className="divide-y divide-neutral-100">
          {sortedBlocks.map((block) => {
            const cat = getCategoryInfo(block.category);
            const isPast = parseTime(block.endTime) < currentMinutes;
            const isCurrent = block.id === currentBlock?.id;
            return (
              <div
                key={block.id}
                className={`flex items-center gap-4 py-4 group ${isPast ? 'opacity-40' : ''}`}
              >
                <span className="text-sm text-neutral-400 tabular-nums w-12">
                  {formatTime(block.startTime).replace(' AM', '').replace(' PM', '')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-base ${isCurrent ? 'text-neutral-900 font-medium' : 'text-neutral-900'}`}>
                    {block.title}
                  </p>
                  {isCurrent && <p className="text-xs text-rose-500 mt-0.5">Now</p>}
                </div>
                <button
                  onClick={() => onDeleteBlock?.(block.id)}
                  className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-neutral-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </WidgetWrapper>
  );
}
