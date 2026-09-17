import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { BookOpen, FileText, Folder, Kanban, RotateCcw, Trash2, Check } from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useReadingList } from '../../hooks/useReadingList';
import { useConfirm } from '../common/ConfirmDialog';
import { TRASH_RETENTION_DAYS, trashDaysLeft } from '../../lib/sectionTree';

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function SectionIcon({ type }) {
  const Icon = type === 'folder' ? Folder : type === 'board' ? Kanban : FileText;
  return <Icon size={18} aria-hidden="true" className="flex-shrink-0 text-neutral-400 dark:text-neutral-500" />;
}

function SectionHeading({ children, count }) {
  return (
    <h2 className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-medium mb-3">
      {children}
      <span className="tabular-nums normal-case tracking-normal">{count}</span>
    </h2>
  );
}

function TrashRow({ icon, name, detail, deletedAt, busy, onRestore, onDeleteForever }) {
  const deleted = toDate(deletedAt);
  const daysLeft = trashDaysLeft(deletedAt);
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="mt-0.5">{icon}</span>
        <div className="min-w-0">
          <p className="text-base text-neutral-900 dark:text-neutral-100 truncate">{name}</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
            {deleted ? `Deleted ${format(deleted, 'd MMM yyyy')}` : 'Deleted'}
            {' · '}
            <span className={daysLeft <= 3 ? 'text-rose-600 dark:text-rose-400' : undefined}>
              {daysLeft === 0 ? 'Deleted for good soon' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
            </span>
            {detail && <> · {detail}</>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
        <button
          type="button"
          onClick={onRestore}
          disabled={busy}
          aria-label={`Restore ${name}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600"
        >
          <RotateCcw size={14} aria-hidden="true" /> Restore
        </button>
        <button
          type="button"
          onClick={onDeleteForever}
          disabled={busy}
          aria-label={`Delete ${name} forever`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 dark:focus-visible:ring-rose-800"
        >
          <Trash2 size={14} aria-hidden="true" /> Delete forever
        </button>
      </div>
    </li>
  );
}

// Deleted notes/boards/folders and papers, with restore and delete forever.
export default function TrashView({ onSelect }) {
  const { trashedSections, restoreSection, deleteSectionForever, emptyTrash } = useFirestore();
  const { trashedPapers, restorePaper, deletePaperForever, isLoading: papersLoading } = useReadingList();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const showNotice = (next) => {
    clearTimeout(noticeTimer.current);
    setNotice(next);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  };

  // One entry per delete: the item the user deleted plus what was inside it
  const sectionGroups = useMemo(() => {
    const groups = new Map();
    for (const s of trashedSections) {
      const rootId = s.trashRootId ?? s.id;
      if (!groups.has(rootId)) groups.set(rootId, { rootId, root: null, count: 0 });
      const g = groups.get(rootId);
      g.count += 1;
      if (s.id === rootId) g.root = s;
    }
    return [...groups.values()]
      .map((g) => ({ ...g, root: g.root ?? trashedSections.find((s) => (s.trashRootId ?? s.id) === g.rootId) }))
      .sort((a, b) => String(b.root.deletedAt).localeCompare(String(a.root.deletedAt)));
  }, [trashedSections]);

  const papers = useMemo(
    () => [...trashedPapers].sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt))),
    [trashedPapers],
  );

  const total = sectionGroups.length + papers.length;

  const run = async (fn, errorText, success) => {
    setBusy(true);
    try {
      await fn();
      if (success) showNotice(success);
    } catch (err) {
      console.error(errorText, err);
      showNotice({ text: `${errorText} Check your connection and try again.`, error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreSection = (group) => run(
    () => restoreSection(group.rootId),
    `Couldn't restore “${group.root.name || 'Untitled'}”.`,
    { text: `Restored “${group.root.name || 'Untitled'}”${group.count > 1 ? ` and ${group.count - 1} ${group.count === 2 ? 'item' : 'items'} inside it` : ''}.`, open: { id: group.rootId } },
  );

  const handleRestorePaper = (paper) => run(
    () => restorePaper(paper.id),
    `Couldn't restore “${paper.title || 'Untitled'}”.`,
    { text: `Restored “${paper.title || 'Untitled'}” to your reading list.`, open: { id: 'reading-list', type: 'reading-list', name: 'Reading List', paperId: paper.id } },
  );

  const handleDeleteSectionForever = async (group) => {
    const name = group.root.name || 'Untitled';
    const inside = group.count - 1;
    const ok = await confirm({
      title: `Delete “${name}” forever?`,
      body: `${inside > 0 ? `This also deletes ${inside} ${inside === 1 ? 'item' : 'items'} inside it. ` : ''}This cannot be undone.`,
      confirmLabel: 'Delete forever',
      danger: true,
    });
    if (ok) run(() => deleteSectionForever(group.rootId), `Couldn't delete “${name}”.`);
  };

  const handleDeletePaperForever = async (paper) => {
    const name = paper.title || 'Untitled';
    const ok = await confirm({
      title: `Delete “${name}” forever?`,
      body: `${paper.file ? 'Its attached file will also be removed. ' : ''}This cannot be undone.`,
      confirmLabel: 'Delete forever',
      danger: true,
    });
    if (ok) run(() => deletePaperForever(paper.id), `Couldn't delete “${name}”.`);
  };

  const handleEmptyTrash = async () => {
    const ok = await confirm({
      title: 'Empty Trash?',
      body: `${total} ${total === 1 ? 'item' : 'items'} will be deleted forever, including attached files. This cannot be undone.`,
      confirmLabel: 'Empty Trash',
      danger: true,
    });
    if (!ok) return;
    run(async () => {
      await emptyTrash();
      for (const paper of papers) await deletePaperForever(paper.id);
    }, "Couldn't empty Trash.", { text: 'Trash emptied.' });
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[var(--bg-page)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl font-medium text-neutral-900 dark:text-neutral-100 tracking-tight">Trash</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Deleted items stay here for {TRASH_RETENTION_DAYS} days, then they’re deleted for good.
            </p>
          </div>
          {total > 0 && (
            <button
              type="button"
              onClick={handleEmptyTrash}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 border border-neutral-200 dark:border-neutral-700 hover:border-rose-300 dark:hover:border-rose-800 bg-white dark:bg-neutral-900 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 dark:focus-visible:ring-rose-800"
            >
              <Trash2 size={15} aria-hidden="true" /> Empty Trash
            </button>
          )}
        </header>

        <div role="status" aria-live="polite">
          {notice && (
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 mb-6 px-4 py-3 rounded-xl border text-sm ${
              notice.error
                ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
            }`}>
              {!notice.error && <Check size={16} aria-hidden="true" className="flex-shrink-0" />}
              <span className="flex-1 min-w-0">{notice.text}</span>
              {notice.open && onSelect && (
                <button type="button" onClick={() => onSelect(notice.open)} className="font-medium underline underline-offset-2 hover:no-underline">
                  Open
                </button>
              )}
            </div>
          )}
        </div>

        {total === 0 ? (
          papersLoading ? null : (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                <Trash2 size={24} aria-hidden="true" className="text-neutral-400 dark:text-neutral-500" />
              </div>
              <p className="font-serif text-xl text-neutral-900 dark:text-neutral-100 mb-1">Trash is empty</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs">
                Notes, boards, folders and papers you delete appear here, so you can bring them back.
              </p>
            </div>
          )
        ) : (
          <div className="space-y-10">
            {sectionGroups.length > 0 && (
              <section aria-label="Notes and boards">
                <SectionHeading count={sectionGroups.length}>Notes &amp; boards</SectionHeading>
                <ul className="space-y-2">
                  {sectionGroups.map((g) => (
                    <TrashRow
                      key={g.rootId}
                      icon={<SectionIcon type={g.root.type} />}
                      name={g.root.name || 'Untitled'}
                      detail={g.count > 1 ? `${g.count - 1} ${g.count === 2 ? 'item' : 'items'} inside` : null}
                      deletedAt={g.root.deletedAt}
                      busy={busy}
                      onRestore={() => handleRestoreSection(g)}
                      onDeleteForever={() => handleDeleteSectionForever(g)}
                    />
                  ))}
                </ul>
              </section>
            )}
            {papers.length > 0 && (
              <section aria-label="Papers">
                <SectionHeading count={papers.length}>Papers</SectionHeading>
                <ul className="space-y-2">
                  {papers.map((p) => (
                    <TrashRow
                      key={p.id}
                      icon={<BookOpen size={18} aria-hidden="true" className="flex-shrink-0 text-neutral-400 dark:text-neutral-500" />}
                      name={p.title || 'Untitled'}
                      detail={p.file ? 'Has attached file' : (p.authors || null)}
                      deletedAt={p.deletedAt}
                      busy={busy}
                      onRestore={() => handleRestorePaper(p)}
                      onDeleteForever={() => handleDeletePaperForever(p)}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
