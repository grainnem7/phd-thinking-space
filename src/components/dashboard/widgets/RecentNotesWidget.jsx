import { ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WidgetWrapper from './WidgetWrapper';

export default function RecentNotesWidget({ onRemove, notes = [], sections = [], onNavigate }) {
  const getSectionName = (id) => sections.find(s => s.id === id)?.name || 'Notes';

  const parseDate = (v) => {
    if (!v) return null;
    try { return v.toDate ? v.toDate() : new Date(v); } catch { return null; }
  };

  const recent = [...notes]
    .sort((a, b) => {
      const dA = parseDate(a.updatedAt) || parseDate(a.createdAt) || new Date(0);
      const dB = parseDate(b.updatedAt) || parseDate(b.createdAt) || new Date(0);
      return dB - dA;
    })
    .slice(0, 6);

  const timeAgo = (note) => {
    const d = parseDate(note.updatedAt) || parseDate(note.createdAt);
    if (!d || isNaN(d.getTime())) return '';
    try { return formatDistanceToNow(d, { addSuffix: true }); } catch { return ''; }
  };

  const getPreview = (content) => {
    if (!content) return '';
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        const block = parsed.find(b => b.content?.length > 0 && b.content[0].text);
        if (block) return block.content.map(c => c.text).join('').slice(0, 60);
      }
    } catch { return content.slice(0, 60); }
    return '';
  };

  return (
    <WidgetWrapper title="Recent Notes" onRemove={onRemove}>
      {recent.length === 0 ? (
        <p className="text-sm text-neutral-400">No notes yet</p>
      ) : (
        <div className="divide-y divide-neutral-100">
          {recent.map((note) => {
            const preview = getPreview(note.content);
            return (
              <button
                key={note.id}
                onClick={() => onNavigate?.(note)}
                className="w-full flex items-center gap-4 py-3 group text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-base text-neutral-900">{note.name}</p>
                  {preview && <p className="text-xs text-neutral-400 truncate mt-0.5">{preview}</p>}
                  <p className="text-xs text-neutral-400 mt-1">
                    {getSectionName(note.parentId)} · {timeAgo(note)}
                  </p>
                </div>
                <ChevronRight size={16} className="text-neutral-300 group-hover:text-neutral-500 transition-colors" />
              </button>
            );
          })}
        </div>
      )}
    </WidgetWrapper>
  );
}
