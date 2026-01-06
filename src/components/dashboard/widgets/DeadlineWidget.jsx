import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { differenceInDays, format, parseISO } from 'date-fns';
import WidgetWrapper from './WidgetWrapper';

export default function DeadlineWidget({ onRemove, deadlines = [], onAddDeadline, onDeleteDeadline }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newDeadline, setNewDeadline] = useState({ title: '', date: '' });

  const getDaysRemaining = (dateStr) => {
    return differenceInDays(parseISO(dateStr), new Date());
  };

  const handleAdd = () => {
    if (newDeadline.title && newDeadline.date) {
      onAddDeadline?.({ title: newDeadline.title, date: newDeadline.date, createdAt: new Date().toISOString() });
      setNewDeadline({ title: '', date: '' });
      setIsAdding(false);
    }
  };

  const sorted = [...deadlines].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <WidgetWrapper
      title="Deadlines"
      onRemove={onRemove}
      actions={!isAdding && (
        <button onClick={() => setIsAdding(true)} className="text-neutral-300 hover:text-neutral-500 transition-colors">
          <Plus size={15} />
        </button>
      )}
    >
      {/* Add form */}
      {isAdding && (
        <div className="mb-4 space-y-3">
          <input
            type="text"
            placeholder="Deadline title"
            value={newDeadline.title}
            onChange={(e) => setNewDeadline({ ...newDeadline, title: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <input
            type="date"
            value={newDeadline.date}
            onChange={(e) => setNewDeadline({ ...newDeadline, date: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newDeadline.title || !newDeadline.date}
              className="flex-1 py-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors disabled:text-neutral-300"
            >
              Add
            </button>
            <button
              onClick={() => { setIsAdding(false); setNewDeadline({ title: '', date: '' }); }}
              className="flex-1 py-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Deadline list */}
      {sorted.length === 0 && !isAdding ? (
        <button
          onClick={() => setIsAdding(true)}
          className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors flex items-center gap-2"
        >
          <Plus size={15} />
          Add deadline
        </button>
      ) : (
        <div className="divide-y divide-neutral-100">
          {sorted.map((d) => {
            const days = getDaysRemaining(d.date);
            const isUrgent = days <= 7 && days >= 0;
            const isOverdue = days < 0;
            return (
              <div key={d.id} className={`flex items-center gap-4 py-4 group ${isOverdue ? 'opacity-40' : ''}`}>
                {/* Large number display */}
                <div className="w-12 text-right">
                  <span className={`font-serif text-3xl font-medium tabular-nums ${isUrgent ? 'text-amber-600' : 'text-neutral-300'}`}>
                    {isOverdue ? Math.abs(days) : days}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base text-neutral-900">{d.title}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : format(parseISO(d.date), 'MMM d')}
                  </p>
                </div>
                <button
                  onClick={() => onDeleteDeadline?.(d.id)}
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
