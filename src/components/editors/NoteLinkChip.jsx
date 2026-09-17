import { useContext } from 'react';
import { NoteLinkContext } from './noteLinks';

// Renders a noteLink inline node. Shows the linked note's live name; links to
// deleted or missing notes are muted and struck through.
export default function NoteLinkChip({ inlineContent }) {
  const { notesById, onOpenNote } = useContext(NoteLinkContext);
  const { noteId, name } = inlineContent.props;
  const live = notesById?.get(noteId);
  const missing = Boolean(notesById) && !live;
  const label = live?.name || name || 'Untitled';

  const open = (e) => {
    if (missing || !onOpenNote) return;
    e.preventDefault();
    e.stopPropagation();
    onOpenNote(noteId);
  };

  return (
    <span
      role="link"
      aria-disabled={missing || undefined}
      data-note-id={noteId}
      title={missing ? `"${name || 'Untitled'}" no longer exists` : `Open "${label}"`}
      onClick={open}
      className={missing
        ? 'note-link px-1 rounded text-neutral-400 dark:text-neutral-500 line-through decoration-neutral-300 dark:decoration-neutral-600 cursor-not-allowed'
        : 'note-link px-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 underline decoration-neutral-300 dark:decoration-neutral-600 underline-offset-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer'}
    >
      <span aria-hidden="true" className="opacity-50">[[</span>{label}<span aria-hidden="true" className="opacity-50">]]</span>
    </span>
  );
}
