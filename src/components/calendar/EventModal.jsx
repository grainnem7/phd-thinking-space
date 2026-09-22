import { useState, useEffect, useMemo } from 'react';
import { FileText, BookOpen, X, Trash2, Repeat } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { CategoryPicker, ColorSwatches, CategoryManager } from './CategoryControls';
import { timeToMinutes } from '../../utils/date';
import { weekdayOf, daysBetween, addDaysToKey } from '../../lib/recurrence';
import RepeatFields from './RepeatFields';
import { repeatFormFrom, recurrenceFromForm, repeatError } from './repeatForm';

export const INPUT_CLASS = 'w-full px-3 py-2.5 text-base bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-neutral-900 dark:text-neutral-100';
const LABEL_CLASS = 'block text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5';

function emptyForm(defaults) {
  const d = defaults || {};
  return {
    type: d.type === 'deadline' ? 'deadline' : 'event',
    title: '',
    date: d.date || '',
    endDate: d.date || '',
    allDay: d.allDay ?? false,
    startTime: d.startTime || '09:00',
    endTime: d.endTime || '10:00',
    color: 'sky',
    categoryId: d.categoryId || null,
    notes: '',
    links: [],
    repeat: repeatFormFrom(null, d.date),
  };
}

// Create or edit a calendar event, or a deadline (which also appears in the dashboard Deadlines widget).
export default function EventModal({ isOpen, onClose, entry, defaults, sections = [], papers = [], onSave, onDelete }) {
  const [form, setForm] = useState(() => emptyForm(defaults));
  const [linkQuery, setLinkQuery] = useState('');
  const [manageCategories, setManageCategories] = useState(false);
  const isEditing = Boolean(entry);

  useEffect(() => {
    if (!isOpen) return;
    setLinkQuery('');
    if (entry?.source === 'deadline') {
      setForm({ ...emptyForm(), type: 'deadline', title: entry.title, date: entry.date, allDay: true });
    } else if (entry) {
      setForm({
        type: 'event',
        title: entry.title || '',
        date: entry.date || '',
        endDate: entry.date ? addDaysToKey(entry.date, Math.max(0, Number(entry.durationDays) || 0)) : '',
        allDay: Boolean(entry.allDay),
        startTime: entry.startTime || '09:00',
        endTime: entry.endTime || '10:00',
        color: entry.color || 'sky',
        categoryId: entry.categoryId || null,
        notes: entry.notes || '',
        links: entry.links || [],
        repeat: repeatFormFrom(entry.recurrence, entry.date),
      });
    } else {
      setForm(emptyForm(defaults));
    }
    // Only reset when the dialog opens or switches target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entry?.id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isOverride = Boolean(entry?.recurringEventId);

  // Moving the start date of a single-weekday weekly rule moves its weekday too
  const setDate = (date) => setForm((f) => {
    const { repeat } = f;
    const weekly = repeat.preset === 'weekly' || repeat.preset === 'biweekly' || repeat.preset === 'never';
    const followsDate = f.date && date && repeat.byWeekday.length === 1 && repeat.byWeekday[0] === weekdayOf(f.date);
    // Keep the event's length when the start date moves
    const length = f.date && f.endDate && f.endDate >= f.date ? daysBetween(f.date, f.endDate) : 0;
    return {
      ...f,
      date,
      endDate: date ? addDaysToKey(date, length) : date,
      repeat: weekly && followsDate ? { ...repeat, byWeekday: [weekdayOf(date)] } : repeat,
    };
  });

  const linkOptions = useMemo(() => {
    const q = linkQuery.trim().toLowerCase();
    if (!q) return [];
    const linked = new Set(form.links.map((l) => `${l.type}:${l.id}`));
    const notes = sections
      .filter((s) => s.type === 'note' && s.name?.toLowerCase().includes(q))
      .map((s) => ({ type: 'note', id: s.id, name: s.name }));
    const paperMatches = papers
      .filter((p) => [p.title, p.authors, p.year].filter(Boolean).join(' ').toLowerCase().includes(q))
      .map((p) => ({ type: 'paper', id: p.id, name: p.title || 'Untitled paper' }));
    return [...notes, ...paperMatches].filter((o) => !linked.has(`${o.type}:${o.id}`)).slice(0, 8);
  }, [linkQuery, sections, papers, form.links]);

  const multiDay = form.type === 'event' && Boolean(form.date && form.endDate && form.endDate > form.date);
  const endDateError = form.type === 'event' && Boolean(form.date && form.endDate && form.endDate < form.date);
  const timeError = form.type === 'event' && !form.allDay && !multiDay && !endDateError
    && timeToMinutes(form.endTime) !== null && timeToMinutes(form.startTime) !== null
    && timeToMinutes(form.endTime) < timeToMinutes(form.startTime);
  const repeatInvalid = form.type === 'event' && !isOverride && Boolean(repeatError(form.repeat, form.date));
  const canSave = form.title.trim() && form.date && !timeError && !endDateError && !repeatInvalid;

  const handleSave = () => {
    if (!canSave) return;
    if (form.type === 'deadline') {
      onSave?.({ type: 'deadline', data: { title: form.title.trim(), date: form.date } });
    } else {
      onSave?.({
        type: 'event',
        data: {
          kind: 'event',
          title: form.title.trim(),
          date: form.date,
          durationDays: multiDay ? daysBetween(form.date, form.endDate) : 0,
          allDay: form.allDay,
          startTime: form.allDay ? null : form.startTime,
          endTime: form.allDay ? null : form.endTime,
          color: form.color,
          categoryId: form.categoryId || null,
          notes: form.notes.trim(),
          links: form.links,
          // Edited single occurrences never repeat themselves
          ...(isOverride ? {} : { recurrence: recurrenceFromForm(form.repeat, form.date) }),
        },
      });
    }
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `Edit ${form.type}` : 'New'} size="md">
      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); handleSave(); }}
      >
        {!isEditing && (
          <div className="inline-flex p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg" role="radiogroup" aria-label="Type">
            {[['event', 'Event'], ['deadline', 'Deadline']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.type === value}
                onClick={() => set({ type: value })}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${form.type === value
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div>
          <label htmlFor="event-title" className={LABEL_CLASS}>Title</label>
          <input
            id="event-title"
            type="text"
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder={form.type === 'deadline' ? 'e.g. Ethics application due' : 'e.g. Supervision meeting'}
            autoFocus
            className={INPUT_CLASS}
          />
        </div>

        {form.type === 'event' ? (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-date" className={LABEL_CLASS}>Start date</label>
                <input id="event-date" type="date" value={form.date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLASS} />
              </div>
              <div>
                <label htmlFor="event-end-date" className={LABEL_CLASS}>End date</label>
                <input
                  id="event-end-date"
                  type="date"
                  value={form.endDate}
                  min={form.date || undefined}
                  onChange={(e) => set({ endDate: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            {endDateError && <p className="text-sm text-rose-600 mt-2">The end date can't be before the start date.</p>}
            {multiDay && !endDateError && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                Runs for {daysBetween(form.date, form.endDate) + 1} days
              </p>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="event-date" className={LABEL_CLASS}>Date</label>
            <input id="event-date" type="date" value={form.date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLASS} />
          </div>
        )}

        {form.type === 'event' && (
          <>
            <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(e) => set({ allDay: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-300 accent-neutral-800"
              />
              All day
            </label>

            {!form.allDay && (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="event-start" className={LABEL_CLASS}>{multiDay ? 'Start time' : 'Starts'}</label>
                    <input id="event-start" type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label htmlFor="event-end" className={LABEL_CLASS}>{multiDay ? 'End time (last day)' : 'Ends'}</label>
                    <input id="event-end" type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} className={INPUT_CLASS} />
                  </div>
                </div>
                {timeError && <p className="text-sm text-rose-600 mt-2">End time must be after the start time.</p>}
              </div>
            )}

            {isOverride ? (
              <p className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                <Repeat size={14} aria-hidden="true" /> Changed occurrence of a repeating event
              </p>
            ) : (
              <RepeatFields value={form.repeat} onChange={(repeat) => set({ repeat })} dateKey={form.date} />
            )}

            <div>
              <span className={LABEL_CLASS}>Category</span>
              <CategoryPicker
                value={form.categoryId}
                onChange={(categoryId) => set({ categoryId })}
                onManage={() => setManageCategories(true)}
              />
              {!form.categoryId && (
                <div className="mt-3">
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">Or pick a colour</span>
                  <ColorSwatches value={form.color} onChange={(color) => set({ color })} />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="event-notes" className={LABEL_CLASS}>Notes</label>
              <textarea
                id="event-notes"
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
                rows={3}
                placeholder="Agenda, location, things to bring…"
                className={`${INPUT_CLASS} resize-y`}
              />
            </div>

            <div>
              <label htmlFor="event-link" className={LABEL_CLASS}>Linked notes &amp; papers</label>
              {form.links.length > 0 && (
                <ul className="flex flex-wrap gap-2 mb-2">
                  {form.links.map((link) => (
                    <li key={`${link.type}:${link.id}`} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-md max-w-full">
                      {link.type === 'paper' ? <BookOpen size={13} className="flex-shrink-0" /> : <FileText size={13} className="flex-shrink-0" />}
                      <span className="truncate">{link.name}</span>
                      <button
                        type="button"
                        onClick={() => set({ links: form.links.filter((l) => !(l.type === link.type && l.id === link.id)) })}
                        aria-label={`Remove link to ${link.name}`}
                        className="p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input
                id="event-link"
                type="text"
                value={linkQuery}
                onChange={(e) => setLinkQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (linkOptions[0]) { set({ links: [...form.links, linkOptions[0]] }); setLinkQuery(''); }
                  }
                }}
                placeholder="Search notes and papers…"
                className={INPUT_CLASS}
              />
              {linkQuery.trim() && (
                <ul className="mt-1 border border-neutral-200 dark:border-neutral-700 rounded-lg divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden">
                  {linkOptions.length === 0 ? (
                    <li className="px-3 py-2.5 text-sm text-neutral-400">No matching notes or papers</li>
                  ) : linkOptions.map((option) => (
                    <li key={`${option.type}:${option.id}`}>
                      <button
                        type="button"
                        onClick={() => { set({ links: [...form.links, option] }); setLinkQuery(''); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      >
                        {option.type === 'paper' ? <BookOpen size={14} className="text-neutral-400 flex-shrink-0" /> : <FileText size={14} className="text-neutral-400 flex-shrink-0" />}
                        <span className="truncate">{option.name}</span>
                        <span className="ml-auto text-xs text-neutral-400 capitalize">{option.type}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="flex items-center gap-2 pt-2">
          {isEditing && onDelete && (
            <Button type="button" variant="ghost" onClick={onDelete} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/40">
              <Trash2 size={16} /> Delete
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!canSave}>Save</Button>
          </div>
        </div>
      </form>
    </Modal>
    <CategoryManager isOpen={manageCategories} onClose={() => setManageCategories(false)} />
    </>
  );
}
