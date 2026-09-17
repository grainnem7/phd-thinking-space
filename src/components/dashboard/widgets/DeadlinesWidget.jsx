import { useState } from 'react';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import { daysUntil, parseLocalDate } from '../../../utils/date';
import WidgetHeader from './WidgetHeader';
import {
  inputClass,
  editInputClass,
  editRowClass,
  primaryTextButton,
  secondaryTextButton,
  linkButton,
  iconButton,
  dangerIconButton,
  revealOnHover,
} from './styles';

const EMPTY = { title: '', date: '' };

const pluralDays = (n) => (n === 1 ? 'day' : 'days');

// Visual treatment for a deadline based on how many days are left
function describe(days, dateStr) {
  if (days < 0) {
    const n = Math.abs(days);
    return {
      subtitle: format(parseLocalDate(dateStr), 'MMM d'),
      subtitleClass: 'text-neutral-400',
      value: n,
      unit: `${pluralDays(n)} overdue`,
      tone: 'text-rose-600 dark:text-rose-400',
    };
  }
  if (days === 0) {
    return {
      subtitle: 'Due today',
      subtitleClass: 'text-rose-600 dark:text-rose-400 font-medium',
      value: 'Today',
      unit: null,
      tone: 'text-rose-600 dark:text-rose-400',
    };
  }
  if (days === 1) {
    return {
      subtitle: 'Due tomorrow',
      subtitleClass: 'text-amber-600 dark:text-amber-500 font-medium',
      value: 1,
      unit: 'day',
      tone: 'text-amber-600 dark:text-amber-500',
    };
  }
  const isUrgent = days <= 7;
  return {
    subtitle: format(parseLocalDate(dateStr), 'MMM d'),
    subtitleClass: 'text-neutral-400',
    value: days,
    unit: pluralDays(days),
    tone: isUrgent ? 'text-amber-600 dark:text-amber-500' : 'text-neutral-300 dark:text-neutral-600',
    unitTone: isUrgent ? 'text-amber-600 dark:text-amber-500' : 'text-neutral-400 dark:text-neutral-500',
  };
}

export default function DeadlinesWidget({ deadlines = [], onAddDeadline, onUpdateDeadline, onDeleteDeadline }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newDeadline, setNewDeadline] = useState(EMPTY);
  const [editDeadline, setEditDeadline] = useState(EMPTY);

  const handleAdd = () => {
    if (newDeadline.title && newDeadline.date) {
      onAddDeadline?.({ title: newDeadline.title, date: newDeadline.date, createdAt: new Date().toISOString() });
      setNewDeadline(EMPTY);
      setIsAdding(false);
    }
  };

  const handleStartEdit = (d) => {
    setEditingId(d.id);
    setEditDeadline({ title: d.title, date: d.date });
  };

  const handleSaveEdit = () => {
    if (editDeadline.title && editDeadline.date && editingId) {
      onUpdateDeadline?.(editingId, { title: editDeadline.title, date: editDeadline.date });
      setEditingId(null);
      setEditDeadline(EMPTY);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDeadline(EMPTY);
  };

  const sorted = [...deadlines].sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));

  return (
    <>
      <WidgetHeader title="Deadlines" addLabel="Add deadline" onAdd={() => setIsAdding(true)} />
      <div className="flex-1 overflow-y-auto">
        {isAdding && (
          <div className="p-4 sm:p-6 border-b border-neutral-100 dark:border-neutral-800 space-y-3">
            <input
              type="text"
              placeholder="Deadline title"
              aria-label="Deadline title"
              value={newDeadline.title}
              onChange={(e) => setNewDeadline({ ...newDeadline, title: e.target.value })}
              className={inputClass}
              autoFocus
            />
            <input
              type="date"
              aria-label="Deadline date"
              value={newDeadline.date}
              onChange={(e) => setNewDeadline({ ...newDeadline, date: e.target.value })}
              className={inputClass}
            />
            <div className="flex gap-2">
              <button type="button" onClick={handleAdd} disabled={!newDeadline.title || !newDeadline.date} className={primaryTextButton}>
                Add
              </button>
              <button
                type="button"
                onClick={() => { setIsAdding(false); setNewDeadline(EMPTY); }}
                className={secondaryTextButton}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {sorted.length === 0 && !isAdding ? (
          <div className="p-4 sm:p-6">
            <button type="button" onClick={() => setIsAdding(true)} className={`text-base flex items-center gap-2 ${linkButton}`}>
              <Plus size={16} aria-hidden="true" /> Add deadline
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {sorted.map((d) => {
              if (editingId === d.id) {
                return (
                  <div key={d.id} className={`p-4 sm:p-6 space-y-3 ${editRowClass}`}>
                    <input
                      type="text"
                      placeholder="Deadline title"
                      aria-label="Deadline title"
                      value={editDeadline.title}
                      onChange={(e) => setEditDeadline({ ...editDeadline, title: e.target.value })}
                      className={editInputClass}
                      autoFocus
                    />
                    <input
                      type="date"
                      aria-label="Deadline date"
                      value={editDeadline.date}
                      onChange={(e) => setEditDeadline({ ...editDeadline, date: e.target.value })}
                      className={editInputClass}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={!editDeadline.title || !editDeadline.date}
                        className={`${primaryTextButton} flex items-center justify-center gap-1`}
                      >
                        <Check size={16} aria-hidden="true" /> Save
                      </button>
                      <button type="button" onClick={handleCancelEdit} className={`${secondaryTextButton} flex items-center justify-center gap-1`}>
                        <X size={16} aria-hidden="true" /> Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              const days = daysUntil(d.date);
              const info = describe(days, d.date);

              return (
                <div key={d.id} className="px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between group">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-base sm:text-lg text-neutral-900 dark:text-neutral-100 truncate">{d.title}</p>
                    <p className={`text-sm sm:text-base mt-1 ${info.subtitleClass}`}>{info.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1 ${revealOnHover}`}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(d)}
                        className={iconButton}
                        title="Edit"
                        aria-label={`Edit "${d.title}"`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteDeadline?.(d.id)}
                        className={dangerIconButton}
                        title="Delete"
                        aria-label={`Delete "${d.title}"`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="flex items-baseline gap-1 flex-shrink-0">
                      <span className={`font-serif font-medium tabular-nums ${typeof info.value === 'number' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'} ${info.tone}`}>
                        {info.value}
                      </span>
                      {info.unit && (
                        <span className={`text-sm sm:text-base ${info.unitTone || info.tone}`}>
                          {info.unit}
                        </span>
                      )}
                    </div>
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
