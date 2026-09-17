import { useId, useState } from 'react';
import { Trash2, Pencil, X, Check } from 'lucide-react';
import WidgetHeader from './WidgetHeader';
import { timeAgo } from './time';
import {
  editInputClass,
  editRowClass,
  primaryTextButton,
  secondaryTextButton,
  iconButton,
  dangerIconButton,
  revealOnHover,
  rowHoverClass,
} from './styles';

export default function QuickCaptureWidget({ captures = [], onAddCapture, onUpdateCapture, onDeleteCapture }) {
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const hintId = useId();

  const handleSubmit = () => {
    if (text.trim()) {
      onAddCapture?.({ text: text.trim(), createdAt: new Date().toISOString() });
      setText('');
    }
  };

  const handleStartEdit = (c) => {
    setEditingId(c.id);
    setEditText(c.text);
  };

  const handleSaveEdit = () => {
    if (editText.trim() && editingId) {
      onUpdateCapture?.(editingId, { text: editText.trim() });
      setEditingId(null);
      setEditText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  return (
    <>
      <WidgetHeader
        title="Quick Capture"
        actions={
          captures.length > 0 ? (
            <span className="text-sm text-neutral-400 tabular-nums" aria-label={`${captures.length} ${captures.length === 1 ? 'capture' : 'captures'}`}>
              {captures.length}
            </span>
          ) : null
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-neutral-100 dark:border-neutral-800">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Capture an idea..."
            aria-label="Capture an idea"
            aria-describedby={hintId}
            className="w-full text-base sm:text-lg bg-transparent text-neutral-900 dark:text-neutral-100 focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
          />
          <p id={hintId} className="text-xs sm:text-sm text-neutral-400 dark:text-neutral-500 mt-2">Press Enter to save</p>
        </div>

        {captures.length === 0 ? (
          <div className="p-4 sm:p-6">
            <p className="text-base text-neutral-400">No captures yet</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {captures.map((c) => {
              if (editingId === c.id) {
                return (
                  <div key={c.id} className={`px-4 sm:px-6 py-3 sm:py-4 space-y-3 ${editRowClass}`}>
                    <input
                      type="text"
                      aria-label="Edit capture"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className={editInputClass}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={!editText.trim()}
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

              return (
                <div key={c.id} className={`px-4 sm:px-6 py-3 sm:py-4 ${rowHoverClass} transition-colors flex items-start justify-between gap-3 group`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-300 break-words">{c.text}</p>
                    <p className="text-sm sm:text-base text-neutral-400 mt-1">{timeAgo(c.createdAt)}</p>
                  </div>
                  <div className={`flex items-center gap-1 flex-shrink-0 ${revealOnHover}`}>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(c)}
                      className={iconButton}
                      title="Edit"
                      aria-label="Edit capture"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCapture?.(c.id)}
                      className={dangerIconButton}
                      title="Delete"
                      aria-label="Delete capture"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
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
