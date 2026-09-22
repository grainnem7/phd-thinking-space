import { useId, useState } from 'react';
import { BookOpen, CalendarDays, CheckSquare, ChevronRight, FileText, Flag, Lightbulb } from 'lucide-react';
import Modal from '../common/Modal';
import EventModal from '../calendar/EventModal';
import AddPaperModal from '../reading-list/AddPaperModal';
import QuickTaskModal from './QuickTaskModal';
import { useCalendar } from '../../hooks/useCalendar';
import { useDashboard } from '../../hooks/useDashboard';
import { useReadingList } from '../../hooks/useReadingList';
import { toDateKey } from '../../utils/date';

function AddTile({ icon, label, hint, onClick }) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start justify-between gap-3 min-h-24 p-3.5 text-left rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-neutral-100 touch-manipulation"
    >
      <Icon size={24} className="text-neutral-600 dark:text-neutral-300" aria-hidden="true" />
      <span className="text-base font-medium">
        {label}
        <span className="block text-sm font-normal text-neutral-500 dark:text-neutral-400">{hint}</span>
      </span>
    </button>
  );
}

function AddRow({ icon, label, onClick }) {
  const Icon = icon;
  return (
    <button type="button" onClick={onClick} className="w-full min-h-[52px] flex items-center gap-3.5 px-4 text-left text-base text-neutral-900 dark:text-neutral-100 touch-manipulation">
      <Icon size={22} className="text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <ChevronRight size={18} className="text-neutral-300 dark:text-neutral-600" aria-hidden="true" />
    </button>
  );
}

function QuickAddFlow({ onClose, sections, onCreateNote, onCreateBoard }) {
  const ideaId = useId();
  const [step, setStep] = useState('sheet'); // sheet | idea | saved | event | deadline | task | paper
  const [idea, setIdea] = useState('');
  const { addItem } = useCalendar();
  const { addDeadline, addQuickCapture } = useDashboard();
  const { papers, collections, addPaper } = useReadingList();
  const boards = sections.filter((s) => s.type === 'board');
  const today = toDateKey(new Date());

  const saveIdea = async (e) => {
    e.preventDefault();
    const text = idea.trim();
    if (!text) return;
    await addQuickCapture({ text, createdAt: new Date().toISOString() });
    setStep('saved');
    setTimeout(onClose, 1200);
  };

  const saveEntry = async ({ type, data }) => {
    onClose();
    if (type === 'deadline') await addDeadline({ ...data, createdAt: new Date().toISOString() });
    else await addItem(data.recurrence ? { ...data, exdates: [] } : data);
  };

  if (step === 'event' || step === 'deadline') {
    return <EventModal isOpen onClose={onClose} entry={null} defaults={{ date: today, type: step }} sections={sections} papers={papers} onSave={saveEntry} />;
  }
  if (step === 'paper') return <AddPaperModal onClose={onClose} onSave={addPaper} collections={collections} />;
  if (step === 'task') return <QuickTaskModal boards={boards} onClose={onClose} />;

  return (
    <Modal isOpen onClose={onClose} title="Add">
      {step === 'saved' && (
        <p role="status" className="py-6 text-center text-base text-neutral-700 dark:text-neutral-200">Saved to Quick Capture</p>
      )}
      {step === 'idea' && (
        <form onSubmit={saveIdea} className="space-y-3">
          <label htmlFor={ideaId} className="sr-only">Idea</label>
          <input
            id={ideaId}
            autoFocus
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Capture an idea…"
            className="w-full px-3 py-3 text-base bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setStep('sheet')} className="px-4 py-2.5 text-base text-neutral-500 dark:text-neutral-400">Back</button>
            <button type="submit" disabled={!idea.trim()} className="px-4 py-2.5 text-base rounded-lg bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-50">Save</button>
          </div>
        </form>
      )}
      {step === 'sheet' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <AddTile icon={FileText} label="Note" hint="A blank note" onClick={() => { onClose(); onCreateNote(); }} />
            <AddTile
              icon={CheckSquare}
              label="Task"
              hint={boards.length ? 'To a board' : 'Create a board first'}
              onClick={() => {
                if (boards.length) setStep('task');
                else { onClose(); onCreateBoard(); }
              }}
            />
            <AddTile icon={CalendarDays} label="Event" hint="On your calendar" onClick={() => setStep('event')} />
            <AddTile icon={Lightbulb} label="Idea" hint="Quick capture" onClick={() => setStep('idea')} />
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden">
            <AddRow icon={Flag} label="Deadline" onClick={() => setStep('deadline')} />
            <AddRow icon={BookOpen} label="Paper to read" onClick={() => setStep('paper')} />
          </div>
        </div>
      )}
    </Modal>
  );
}

// The phone's + button: things to add, each opening the existing form. Mounted
// only while in use, so its data hooks don't listen in the background.
export default function QuickAdd({ open, onClose, sections, onCreateNote, onCreateBoard }) {
  if (!open) return null;
  return <QuickAddFlow onClose={onClose} sections={sections} onCreateNote={onCreateNote} onCreateBoard={onCreateBoard} />;
}
