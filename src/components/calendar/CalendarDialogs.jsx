import { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { INPUT_CLASS } from './EventModal';

const SCOPES = [
  ['this', 'This event', 'Only this occurrence'],
  ['following', 'This and following events', 'This occurrence and all later ones'],
  ['all', 'All events', 'Every occurrence in the series'],
];

// Asks which occurrences of a repeating event an action applies to.
// request: { title, verb: 'Move'|'Save'|'Delete', allowThis } | null
export function SeriesScopeDialog({ request, onChoose }) {
  return (
    <Modal isOpen={Boolean(request)} onClose={() => onChoose(null)} title={request ? `${request.verb} repeating event` : ''} size="sm">
      {request && <ScopeForm request={request} onChoose={onChoose} />}
    </Modal>
  );
}

function ScopeForm({ request, onChoose }) {
  const options = SCOPES.filter(([key]) => key !== 'this' || request.allowThis !== false);
  const [selected, setScope] = useState(options[0][0]);
  const name = useId();
  const danger = request.verb === 'Delete';

  return (
    <form onSubmit={(e) => { e.preventDefault(); onChoose(selected); }}>
      <p className="text-base text-neutral-600 dark:text-neutral-300 mb-4">
        &ldquo;{request.title}&rdquo; repeats. Which events should change?
      </p>
      <fieldset className="space-y-1 mb-6">
        <legend className="sr-only">Apply to</legend>
        {options.map(([key, label, hint]) => (
          <label key={key} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer border transition-colors ${selected === key
            ? 'border-neutral-300 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800'
            : 'border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/50'}`}
          >
            <input type="radio" name={name} value={key} checked={selected === key} onChange={() => setScope(key)} autoFocus={selected === key} className="mt-1 accent-neutral-800" />
            <span>
              <span className="block text-base text-neutral-900 dark:text-neutral-100">{label}</span>
              <span className="block text-sm text-neutral-500 dark:text-neutral-400">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => onChoose(null)}>Cancel</Button>
        <Button type="submit" className={danger ? 'bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:text-white dark:hover:bg-rose-500' : ''}>{request.verb}</Button>
      </div>
    </form>
  );
}

// Keyboard/touch alternative to dragging: pick a new date for an item.
// target: { title, date } | null
export function MoveToDialog({ target, onClose, onMove }) {
  return (
    <Modal isOpen={Boolean(target)} onClose={onClose} title="Move to" size="sm">
      {target && <MoveToForm key={target.key} target={target} onClose={onClose} onMove={onMove} />}
    </Modal>
  );
}

function MoveToForm({ target, onClose, onMove }) {
  const [date, setDate] = useState(target.date);
  const inputId = useId();
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (date && date !== target.date) onMove(date); }}>
      <label htmlFor={inputId} className="block text-base text-neutral-600 dark:text-neutral-300 mb-2">
        New date for &ldquo;{target.title}&rdquo;
      </label>
      <input id={inputId} type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus className={`${INPUT_CLASS} mb-6`} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={!date || date === target.date}>Move</Button>
      </div>
    </form>
  );
}

// "Moved … · Undo" toast; disappears after ~6 seconds.
export function UndoToast({ toast, onUndo, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+1rem)] md:bottom-4 z-40 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 max-w-md w-full sm:w-auto pl-4 pr-2 py-2 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-xl shadow-lg">
        <p className="text-sm min-w-0 flex-1 truncate">{toast.message}</p>
        {toast.undo && (
          <button type="button" onClick={onUndo} className="px-2.5 py-1 text-sm font-medium rounded-md text-sky-300 hover:bg-white/10 dark:text-sky-700 dark:hover:bg-neutral-900/10">
            Undo
          </button>
        )}
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="p-1 rounded-md opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
