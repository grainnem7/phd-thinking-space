import { FileText } from 'lucide-react';

export default function NoteList({ notes, selectedId, onSelect }) {
  if (notes.length === 0) {
    return (
      <div className="p-4 text-center text-slate-500">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No notes yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {notes.map((note) => (
        <button
          key={note.id}
          onClick={() => onSelect(note)}
          className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
            selectedId === note.id
              ? 'bg-blue-100 text-blue-700'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm truncate">{note.name}</span>
          </div>
          {note.updatedAt && (
            <p className="text-xs text-slate-500 mt-1 ml-6">
              {note.updatedAt.toDate?.()?.toLocaleDateString() || 'Recently'}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
