import { addDays, format, startOfWeek } from 'date-fns';
import { parseLocalDate, toDateKey } from '../../utils/date';
import { isDoneColumn } from '../../hooks/useBoards';
import { buildEntries, groupByDate } from '../calendar/calendarEntries';
import { parseDate } from '../dashboard/widgets/time';
import { dailySeries } from '../../hooks/useWritingStats';

export const REFLECTION_PROMPTS = [
  { id: 'wentWell', label: 'What went well?' },
  { id: 'hard', label: 'What was hard?' },
  { id: 'focus', label: 'Focus for next week?' },
];

// Monday 00:00 of the week containing `date`
export function mondayOf(date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function weekInfo(monday) {
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const end = addDays(start, 7); // exclusive
  const days = Array.from({ length: 7 }, (_, i) => toDateKey(addDays(start, i)));
  return { start, end, key: days[0], days, lastKey: days[6] };
}

export function formatWeekRange(start) {
  const last = addDays(start, 6);
  if (start.getFullYear() !== last.getFullYear()) return `${format(start, 'd MMM yyyy')} – ${format(last, 'd MMM yyyy')}`;
  if (start.getMonth() !== last.getMonth()) return `${format(start, 'd MMM')} – ${format(last, 'd MMM yyyy')}`;
  return `${format(start, 'd')} – ${format(last, 'd MMMM yyyy')}`;
}

export const dayLabel = (key, pattern = 'EEE d MMM') => format(parseLocalDate(key), pattern);

const within = (value, week) => {
  const d = parseDate(value);
  return Boolean(d) && d >= week.start && d < week.end;
};

const byDateDesc = (field) => (a, b) => (parseDate(b[field])?.getTime() ?? 0) - (parseDate(a[field])?.getTime() ?? 0);

export function buildWeekReview({ week, sections, papers, writtenByDate, dailyGoal, calendarItems, deadlines, googleEvents, categories, today }) {
  const next = weekInfo(addDays(week.start, 7));

  // Tasks completed, grouped by board
  const taskGroups = [];
  for (const board of sections) {
    if (board.type !== 'board') continue;
    const tasks = (board.tasks || [])
      .filter((t) => within(t.completedAt, week))
      .sort(byDateDesc('completedAt'));
    if (tasks.length) taskGroups.push({ boardId: board.id, boardName: board.name || 'Untitled board', tasks });
  }
  const tasksCompleted = taskGroups.reduce((n, g) => n + g.tasks.length, 0);

  const papersRead = papers.filter((p) => within(p.readAt, week)).sort(byDateDesc('readAt'));

  // Notes
  const notes = sections.filter((s) => s.type === 'note');
  const notesCreated = notes.filter((n) => within(n.createdAt, week)).sort(byDateDesc('createdAt'));
  const createdIds = new Set(notesCreated.map((n) => n.id));
  const notesEdited = notes.filter((n) => !createdIds.has(n.id) && within(n.updatedAt, week)).sort(byDateDesc('updatedAt'));

  // Writing
  const writing = dailySeries(writtenByDate, week.lastKey, 7);
  const wordsWritten = writing.reduce((n, d) => n + d.words, 0);
  const daysGoalMet = dailyGoal > 0 ? writing.filter((d) => d.words >= dailyGoal).length : 0;

  // Calendar: events and deadlines (tasks are covered above)
  const entries = buildEntries({ items: calendarItems, deadlines, sections: [], googleEvents, categories });
  const byDate = groupByDate(entries.filter((e) => e.source !== 'task'));
  const calendarDays = week.days
    .map((date) => ({ date, entries: byDate.get(date) || [] }))
    .filter((d) => d.entries.length);

  const nextEntries = next.days.flatMap((date) => (byDate.get(date) || []));
  const nextDeadlines = nextEntries.filter((e) => e.source === 'deadline');
  const nextEvents = nextEntries.filter((e) => e.source !== 'deadline');

  // Unfinished tasks due by the end of next week (overdue ones first)
  const dueTasks = [];
  for (const board of sections) {
    if (board.type !== 'board') continue;
    const columns = board.columns || [];
    for (const task of board.tasks || []) {
      if (!task.dueDate || task.dueDate > next.lastKey) continue;
      if (isDoneColumn(columns.find((c) => c.id === task.columnId))) continue;
      dueTasks.push({ ...task, boardId: board.id, boardName: board.name || 'Untitled board', overdue: task.dueDate < today });
    }
  }
  dueTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.title || '').localeCompare(b.title || ''));

  return {
    next,
    taskGroups,
    tasksCompleted,
    papersRead,
    notesCreated,
    notesEdited,
    writing,
    wordsWritten,
    daysGoalMet,
    calendarDays,
    nextDeadlines,
    nextEvents,
    dueTasks,
  };
}

export function entryTime(entry) {
  if (entry.allDay || !entry.startTime) return '';
  return entry.endTime ? `${entry.startTime}–${entry.endTime}` : entry.startTime;
}

const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function summaryMarkdown({ week, data, dailyGoal, reflection }) {
  const lines = [`# Weekly review: ${formatWeekRange(week.start)}`, ''];
  const list = (items) => (items.length ? items : ['- None']);

  lines.push('## Summary');
  lines.push(`- Tasks completed: ${data.tasksCompleted}`);
  lines.push(`- Papers read: ${data.papersRead.length}`);
  lines.push(`- Words written: ${data.wordsWritten.toLocaleString()}${dailyGoal > 0 ? ` (daily goal of ${dailyGoal.toLocaleString()} met on ${plural(data.daysGoalMet, 'day')})` : ''}`);
  lines.push(`- Notes: ${data.notesCreated.length} created, ${data.notesEdited.length} edited`, '');

  lines.push('## Tasks completed');
  if (!data.taskGroups.length) lines.push('- None');
  for (const group of data.taskGroups) {
    lines.push(`### ${group.boardName}`);
    group.tasks.forEach((t) => lines.push(`- ${t.title || 'Untitled task'}`));
  }
  lines.push('');

  lines.push('## Papers read');
  lines.push(...list(data.papersRead.map((p) => `- ${p.title || 'Untitled'}${p.authors ? ` — ${p.authors}` : ''}${p.year ? ` (${p.year})` : ''}`)), '');

  lines.push('## Writing');
  data.writing.forEach((d) => lines.push(`- ${dayLabel(d.date)}: ${d.words.toLocaleString()} words`));
  lines.push('');

  lines.push('## Notes');
  lines.push(`- Created: ${data.notesCreated.map((n) => n.name || 'Untitled').join(', ') || 'none'}`);
  lines.push(`- Edited: ${data.notesEdited.map((n) => n.name || 'Untitled').join(', ') || 'none'}`, '');

  lines.push('## Calendar');
  lines.push(...list(data.calendarDays.map((d) => `- ${dayLabel(d.date)}: ${d.entries.map((e) => `${e.source === 'deadline' ? 'Deadline: ' : ''}${e.title}${entryTime(e) ? ` (${entryTime(e)})` : ''}`).join('; ')}`)), '');

  lines.push(`## Next week (${formatWeekRange(data.next.start)})`);
  lines.push('### Deadlines');
  lines.push(...list(data.nextDeadlines.map((e) => `- ${dayLabel(e.date)}: ${e.title}`)));
  lines.push('### Events');
  lines.push(...list(data.nextEvents.map((e) => `- ${dayLabel(e.date)}${entryTime(e) ? ` ${entryTime(e)}` : ''}: ${e.title}`)));
  lines.push('### Tasks due');
  lines.push(...list(data.dueTasks.map((t) => `- ${t.title || 'Untitled task'} (${t.boardName}) — due ${dayLabel(t.dueDate)}${t.overdue ? ', overdue' : ''}`)), '');

  lines.push('## Reflection');
  for (const prompt of REFLECTION_PROMPTS) {
    lines.push(`**${prompt.label}**`, (reflection?.[prompt.id] || '').trim() || '_No notes_', '');
  }

  return lines.join('\n').trim() + '\n';
}
