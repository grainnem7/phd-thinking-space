import { useId, useState } from 'react';
import Modal from '../common/Modal';
import { useTemplates } from '../../hooks/useTemplates';

const INPUT = 'w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500';
const LABEL = 'block text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5';

function SaveForm({ defaultName, getContent, onClose }) {
  const id = useId();
  const { addTemplate } = useTemplates();
  const [name, setName] = useState(defaultName || '');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addTemplate({ name, description, content: getContent() });
      setSaved(true);
      setTimeout(onClose, 900);
    } catch (err) {
      console.error('Could not save template:', err);
      setError(err.message || "Couldn't save the template.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Saves this note&apos;s current content as a reusable template. Use <code className="text-xs">{'{{date}}'}</code> in the text to insert the date a note is created.
      </p>
      <div>
        <label htmlFor={`${id}-name`} className={LABEL}>Template name</label>
        <input id={`${id}-name`} type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus required className={INPUT} />
      </div>
      <div>
        <label htmlFor={`${id}-description`} className={LABEL}>Description</label>
        <input id={`${id}-description`} type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className={INPUT} />
      </div>
      {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex justify-end items-center gap-3 pt-2">
        {saved && <span role="status" className="mr-auto text-sm text-emerald-700 dark:text-emerald-400">Template saved</span>}
        <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="px-4 py-2 text-sm bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white rounded-lg disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save template'}
        </button>
      </div>
    </form>
  );
}

export default function SaveAsTemplateModal({ isOpen, onClose, defaultName, getContent }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Save as template" size="sm">
      <SaveForm defaultName={defaultName} getContent={getContent} onClose={onClose} />
    </Modal>
  );
}
