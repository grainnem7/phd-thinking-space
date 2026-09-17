import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { addDays } from 'date-fns';
import {
  ChevronLeft, ChevronRight, Copy, Check, Printer, CheckCircle2, BookOpen, PenLine, FileText, CalendarDays, AlertCircle, Flag, ArrowRight,
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useReadingList } from '../../hooks/useReadingList';
import { useWritingStats } from '../../hooks/useWritingStats';
import { useCalendar } from '../../hooks/useCalendar';
import { useDeadlines } from '../../hooks/useDashboard';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';
import { toDateKey } from '../../utils/date';
import WordsBarChart from '../writing/WordsBarChart';
import { styleFor } from '../calendar/calendarEntries';
import { useWeeklyReviews } from './useWeeklyReviews';
import {
  REFLECTION_PROMPTS, mondayOf, weekInfo, formatWeekRange, dayLabel, buildWeekReview, entryTime, summaryMarkdown,
} from './weekData';

const SAVE_DELAY_MS = 800;
const EMPTY_REFLECTION = { wentWell: '', hard: '', focus: '' };

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600';
const cardClass = 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl break-inside-avoid';
const navButton = `inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 rounded-lg transition-colors touch-manipulation disabled:opacity-40 disabled:cursor-default ${focusRing}`;
const rowButton = `w-full flex items-center gap-3 px-4 sm:px-5 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors group ${focusRing} focus-visible:ring-inset`;

// Print only the review: hide the app chrome and let the page flow across sheets
const PRINT_CSS = `
@media print {
  @page { margin: 16mm; }
  html, body { background: #fff !important; }
  body *:has([data-review-print]) { display: block !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
  body aside, body .fixed, body header:not([data-review-print] header) { display: none !important; }
  [data-review-print], [data-review-print] * { color: #171717 !important; background: transparent !important; border-color: #d4d4d4 !important; box-shadow: none !important; }
  [data-review-print] svg path { fill: #404040 !important; }
  [data-review-print] textarea { resize: none; overflow: visible; }
}
`;

function Section({ title, icon: Icon, count, children, className = '' }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={`${cardClass} overflow-hidden ${className}`}>
      <div className="px-4 sm:px-5 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
        {Icon && <Icon size={16} aria-hidden="true" className="text-neutral-400 dark:text-neutral-500" />}
        <h2 id={headingId} className="flex-1 text-sm text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-medium">{title}</h2>
        {count != null && <span className="text-sm text-neutral-400 dark:text-neutral-500 tabular-nums">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <p className="px-4 sm:px-5 py-4 text-sm text-neutral-400 dark:text-neutral-500">{children}</p>;
}

function Stat({ label, value, detail }) {
  return (
    <div className={`${cardClass} px-4 py-3 sm:px-5 sm:py-4`}>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{label}</p>
      <p className="font-serif text-2xl sm:text-3xl text-neutral-900 dark:text-neutral-100 tabular-nums mt-1">{value}</p>
      {detail && <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{detail}</p>}
    </div>
  );
}

function RowArrow() {
  return <ArrowRight size={14} aria-hidden="true" className="flex-shrink-0 text-neutral-300 group-hover:text-neutral-500 dark:text-neutral-600 dark:group-hover:text-neutral-400 print:hidden" />;
}

function SubHeading({ children }) {
  return <h3 className="px-4 sm:px-5 pt-3 pb-1 text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{children}</h3>;
}

function EntryRow({ entry, onOpenDay, showDate }) {
  const style = styleFor(entry);
  const time = entryTime(entry);
  return (
    <li>
      <button type="button" onClick={() => onOpenDay(entry.date)} className={rowButton}>
        <span aria-hidden="true" className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot || 'bg-neutral-400'}`} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-neutral-900 dark:text-neutral-100 truncate">
            {entry.source === 'deadline' && <span className="text-amber-700 dark:text-amber-400">Deadline: </span>}
            {entry.title}
          </span>
          {(showDate || time) && (
            <span className="block text-xs text-neutral-400 dark:text-neutral-500">
              {[showDate ? dayLabel(entry.date) : '', time].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        <RowArrow />
      </button>
    </li>
  );
}

export default function WeeklyReview({ onSelect }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const week = useMemo(() => weekInfo(weekStart), [weekStart]);
  const thisWeekKey = toDateKey(mondayOf(new Date()));
  const isThisWeek = week.key === thisWeekKey;
  const todayKey = toDateKey(new Date());

  const { sections } = useFirestore();
  const { papers } = useReadingList();
  const { writtenByDate, dailyGoal } = useWritingStats();
  const { items: calendarItems } = useCalendar();
  const { deadlines } = useDeadlines();
  const google = useGoogleCalendar(week.key, toDateKey(addDays(week.start, 13)));
  const { reviews, loaded: reviewsLoaded, saveReview } = useWeeklyReviews();

  const data = useMemo(() => buildWeekReview({
    week,
    sections,
    papers,
    writtenByDate,
    dailyGoal,
    calendarItems,
    deadlines,
    googleEvents: google.events,
    today: todayKey,
  }), [week, sections, papers, writtenByDate, dailyGoal, calendarItems, deadlines, google.events, todayKey]);

  // --- Reflection: drafts per week, saved shortly after typing stops ---------

  const savedReview = useMemo(() => {
    const matches = reviews.filter((r) => r.weekStart === week.key);
    return matches.find((r) => r.id === week.key) || matches[0] || null;
  }, [reviews, week.key]);
  const [drafts, setDrafts] = useState({});
  const [saveState, setSaveState] = useState({ week: null, status: 'idle' });
  const reflection = drafts[week.key] || {
    wentWell: savedReview?.wentWell || '',
    hard: savedReview?.hard || '',
    focus: savedReview?.focus || '',
  };

  const pendingSave = useRef(null);
  const saveTimer = useRef(null);

  const flushSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const pending = pendingSave.current;
    if (!pending) return;
    pendingSave.current = null;
    setSaveState({ week: pending.week, status: 'saving' });
    Promise.resolve(saveReview(pending.week, pending.fields)).then(
      () => setSaveState((s) => (s.week === pending.week ? { ...s, status: 'saved' } : s)),
      (error) => {
        console.error('Error saving weekly review:', error);
        setSaveState((s) => (s.week === pending.week ? { ...s, status: 'error' } : s));
      },
    );
  }, [saveReview]);

  useEffect(() => () => flushSave(), [flushSave]);

  const updateReflection = (field, value) => {
    const fields = { ...EMPTY_REFLECTION, ...reflection, [field]: value };
    setDrafts((prev) => ({ ...prev, [week.key]: fields }));
    if (pendingSave.current && pendingSave.current.week !== week.key) flushSave();
    pendingSave.current = { week: week.key, fields };
    setSaveState({ week: week.key, status: 'pending' });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, SAVE_DELAY_MS);
  };

  const goToWeek = (date) => {
    flushSave();
    setWeekStart(mondayOf(date));
  };

  // --- Copy / print ---------------------------------------------------------

  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const copySummary = async () => {
    const text = summaryMarkdown({ week, data, dailyGoal, reflection });
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  // --- Navigation -------------------------------------------------------------

  const openNote = (id) => onSelect?.({ id });
  const openTask = (boardId, taskId) => onSelect?.({ id: boardId, openTaskId: taskId });
  const openPaper = (paperId) => onSelect?.({ id: 'reading-list', type: 'reading-list', name: 'Reading List', paperId });
  const openDay = (date) => onSelect?.({ id: 'calendar', type: 'calendar', name: 'Calendar', date });

  const status = saveState.week === week.key ? saveState.status : 'idle';
  const statusText = { pending: 'Unsaved changes', saving: 'Saving…', saved: 'Saved', error: 'Could not save' }[status] || '';

  return (
    <main className="flex-1 overflow-auto bg-[var(--bg-page)]" data-review-print="">
      <style>{PRINT_CSS}</style>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 print:p-0 print:max-w-none">
        <header className="mb-5 sm:mb-6 lg:mb-8">
          <p className="text-sm text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
            Weekly review{isThisWeek ? ' · This week' : ''}
          </p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-medium text-neutral-900 dark:text-neutral-100 tracking-tight" aria-live="polite">
              {formatWeekRange(week.start)}
            </h1>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <div className="flex items-center gap-1" role="group" aria-label="Choose week">
                <button type="button" onClick={() => goToWeek(addDays(week.start, -7))} className={navButton} aria-label="Previous week" title="Previous week">
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => goToWeek(new Date())} disabled={isThisWeek} className={navButton}>
                  This week
                </button>
                <button type="button" onClick={() => goToWeek(addDays(week.start, 7))} className={navButton} aria-label="Next week" title="Next week">
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
              <button type="button" onClick={copySummary} className={navButton}>
                {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy summary'}
              </button>
              <button type="button" onClick={() => window.print()} className={navButton} aria-label="Print review" title="Print">
                <Printer size={16} aria-hidden="true" />
              </button>
              <span className="sr-only" role="status">{copied ? 'Summary copied to clipboard' : ''}</span>
            </div>
          </div>
        </header>

        {/* At a glance */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-5">
          <Stat label="Tasks done" value={data.tasksCompleted} />
          <Stat label="Papers read" value={data.papersRead.length} />
          <Stat
            label="Words written"
            value={data.wordsWritten.toLocaleString()}
            detail={dailyGoal > 0 ? `Goal met ${data.daysGoalMet} of 7 days` : null}
          />
          <Stat label="Notes" value={data.notesCreated.length + data.notesEdited.length} detail={`${data.notesCreated.length} new · ${data.notesEdited.length} edited`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
          <div className="space-y-4 sm:space-y-5">
            <Section title="Tasks completed" icon={CheckCircle2} count={data.tasksCompleted}>
              {data.taskGroups.length === 0 ? (
                <Empty>No tasks moved to done this week.</Empty>
              ) : (
                data.taskGroups.map((group) => (
                  <div key={group.boardId} className="pb-2">
                    <SubHeading>{group.boardName}</SubHeading>
                    <ul>
                      {group.tasks.map((task) => (
                        <li key={task.id}>
                          <button type="button" onClick={() => openTask(group.boardId, task.id)} className={rowButton}>
                            <Check size={14} aria-hidden="true" className="flex-shrink-0 text-neutral-400" />
                            <span className="flex-1 min-w-0 text-sm text-neutral-900 dark:text-neutral-100 truncate">{task.title || 'Untitled task'}</span>
                            <RowArrow />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </Section>

            <Section title="Papers read" icon={BookOpen} count={data.papersRead.length}>
              {data.papersRead.length === 0 ? (
                <Empty>No papers marked as read this week.</Empty>
              ) : (
                <ul className="py-1">
                  {data.papersRead.map((paper) => (
                    <li key={paper.id}>
                      <button type="button" onClick={() => openPaper(paper.id)} className={rowButton}>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-neutral-900 dark:text-neutral-100 truncate">{paper.title || 'Untitled'}</span>
                          {(paper.authors || paper.year) && (
                            <span className="block text-xs text-neutral-400 dark:text-neutral-500 truncate">
                              {[paper.authors, paper.year].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                        <RowArrow />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Notes" icon={FileText} count={data.notesCreated.length + data.notesEdited.length}>
              {data.notesCreated.length + data.notesEdited.length === 0 ? (
                <Empty>No notes created or edited this week.</Empty>
              ) : (
                <div className="pb-2">
                  {[['Created', data.notesCreated], ['Edited', data.notesEdited]].map(([label, list]) => list.length > 0 && (
                    <div key={label}>
                      <SubHeading>{label}</SubHeading>
                      <ul>
                        {list.map((note) => (
                          <li key={note.id}>
                            <button type="button" onClick={() => openNote(note.id)} className={rowButton}>
                              <FileText size={14} aria-hidden="true" className="flex-shrink-0 text-neutral-400" />
                              <span className="flex-1 min-w-0 text-sm text-neutral-900 dark:text-neutral-100 truncate">{note.name || 'Untitled'}</span>
                              <RowArrow />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          <div className="space-y-4 sm:space-y-5">
            <Section title="Words written" icon={PenLine} count={data.wordsWritten.toLocaleString()}>
              <div className="px-4 sm:px-5 py-4">
                <WordsBarChart
                  days={data.writing}
                  goal={dailyGoal}
                  today={todayKey}
                  dayFormat="EEE"
                  onSelectDay={openDay}
                />
                <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                  Dashed line: daily goal of {dailyGoal.toLocaleString()} words. Darker bars met the goal.
                </p>
              </div>
            </Section>

            <Section title="This week's calendar" icon={CalendarDays}>
              {data.calendarDays.length === 0 ? (
                <Empty>No events or deadlines this week.</Empty>
              ) : (
                <div className="pb-2">
                  {data.calendarDays.map((day) => (
                    <div key={day.date}>
                      <h3 className="px-4 sm:px-5 pt-3 pb-1">
                        <button
                          type="button"
                          onClick={() => openDay(day.date)}
                          className={`text-xs uppercase tracking-widest rounded hover:text-neutral-700 dark:hover:text-neutral-200 ${day.date === todayKey ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-500'} ${focusRing}`}
                        >
                          {dayLabel(day.date, 'EEEE d MMM')}
                        </button>
                      </h3>
                      <ul>
                        {day.entries.map((entry) => <EntryRow key={entry.id} entry={entry} onOpenDay={openDay} />)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title={`Next week · ${formatWeekRange(data.next.start)}`} icon={Flag}>
              {data.nextDeadlines.length + data.nextEvents.length + data.dueTasks.length === 0 ? (
                <Empty>Nothing scheduled yet.</Empty>
              ) : (
                <div className="pb-2">
                  {data.nextDeadlines.length > 0 && (
                    <>
                      <SubHeading>Deadlines</SubHeading>
                      <ul>{data.nextDeadlines.map((e) => <EntryRow key={e.id} entry={e} onOpenDay={openDay} showDate />)}</ul>
                    </>
                  )}
                  {data.nextEvents.length > 0 && (
                    <>
                      <SubHeading>Events</SubHeading>
                      <ul>{data.nextEvents.map((e) => <EntryRow key={e.id} entry={e} onOpenDay={openDay} showDate />)}</ul>
                    </>
                  )}
                  {data.dueTasks.length > 0 && (
                    <>
                      <SubHeading>Tasks due</SubHeading>
                      <ul>
                        {data.dueTasks.map((task) => (
                          <li key={`${task.boardId}-${task.id}`}>
                            <button type="button" onClick={() => openTask(task.boardId, task.id)} className={rowButton}>
                              {task.overdue
                                ? <AlertCircle size={14} aria-hidden="true" className="flex-shrink-0 text-rose-500" />
                                : <span aria-hidden="true" className="w-3.5 h-3.5 flex-shrink-0 rounded-full border border-neutral-300 dark:border-neutral-600" />}
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm text-neutral-900 dark:text-neutral-100 truncate">{task.title || 'Untitled task'}</span>
                                <span className="block text-xs text-neutral-400 dark:text-neutral-500 truncate">
                                  {task.boardName} · due {dayLabel(task.dueDate)}
                                  {task.overdue && <span className="text-rose-600 dark:text-rose-400"> · overdue</span>}
                                </span>
                              </span>
                              <RowArrow />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </Section>
          </div>
        </div>

        {/* Reflection */}
        <section aria-labelledby="weekly-reflection-heading" className={`${cardClass} mt-4 sm:mt-5`}>
          <div className="px-4 sm:px-5 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
            <h2 id="weekly-reflection-heading" className="flex-1 text-sm text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-medium">Reflection</h2>
            <span role="status" className={`text-xs print:hidden ${status === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
              {statusText}
            </span>
          </div>
          {!reviewsLoaded ? (
            <Empty>Loading…</Empty>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 sm:p-5">
              {REFLECTION_PROMPTS.map((prompt) => (
                <div key={prompt.id} className="flex flex-col">
                  <label htmlFor={`reflection-${prompt.id}`} className="font-serif text-lg text-neutral-900 dark:text-neutral-100 mb-2">
                    {prompt.label}
                  </label>
                  <textarea
                    id={`reflection-${prompt.id}`}
                    value={reflection[prompt.id]}
                    onChange={(e) => updateReflection(prompt.id, e.target.value)}
                    onBlur={flushSave}
                    rows={5}
                    className="w-full flex-1 px-3 py-2.5 text-base text-neutral-900 dark:text-neutral-100 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 resize-y"
                    placeholder="Write a few lines…"
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
