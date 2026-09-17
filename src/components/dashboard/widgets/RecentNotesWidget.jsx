import { ChevronRight } from 'lucide-react';
import WidgetHeader from './WidgetHeader';
import { parseDate, timeAgo } from './time';
import { rowHoverClass } from './styles';

const getPreview = (content) => {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      const block = parsed.find(b => b.content?.length > 0 && b.content[0].text);
      if (block) return block.content.map(c => c.text).join('').slice(0, 80);
    }
  } catch {
    return content.slice(0, 80);
  }
  return '';
};

export default function RecentNotesWidget({ notes = [], sections = [], onNavigate }) {
  const getSectionName = (id) => sections.find(s => s.id === id)?.name || 'Notes';

  const recent = [...notes]
    .sort((a, b) => {
      const dA = parseDate(a.updatedAt) || parseDate(a.createdAt) || new Date(0);
      const dB = parseDate(b.updatedAt) || parseDate(b.createdAt) || new Date(0);
      return dB - dA;
    })
    .slice(0, 5);

  return (
    <>
      <WidgetHeader title="Recent Notes" />
      <div className="flex-1 overflow-y-auto">
        {recent.length === 0 ? (
          <div className="p-4 sm:p-6">
            <p className="text-base text-neutral-400">No notes yet</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {recent.map((note) => {
              const preview = getPreview(note.content);
              return (
                <button
                  type="button"
                  key={note.id}
                  onClick={() => onNavigate?.(note)}
                  className={`w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between text-left ${rowHoverClass} transition-colors group focus:outline-none focus-visible:bg-neutral-50 dark:focus-visible:bg-neutral-800/40`}
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-base sm:text-lg text-neutral-900 dark:text-neutral-100 truncate">{note.name}</p>
                    {preview && <p className="text-sm text-neutral-400 mt-0.5 truncate">{preview}</p>}
                    <p className="text-xs sm:text-sm text-neutral-400 mt-1 truncate">
                      {getSectionName(note.parentId)} · {timeAgo(note.updatedAt) || timeAgo(note.createdAt)}
                    </p>
                  </div>
                  <ChevronRight
                    size={18}
                    aria-hidden="true"
                    className="text-neutral-300 group-hover:text-neutral-500 dark:text-neutral-600 dark:group-hover:text-neutral-400 transition-colors flex-shrink-0"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
