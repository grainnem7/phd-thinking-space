import { normalizeRecurrence, weekdayOf } from '../../lib/recurrence';

// Editor state for the "Repeat" section of EventModal, and conversion to/from
// the stored `recurrence` shape.

export const REPEAT_OPTIONS = [
  ['never', 'Never'],
  ['daily', 'Daily'],
  ['weekdays', 'Weekdays'],
  ['weekly', 'Weekly'],
  ['biweekly', 'Every 2 weeks'],
  ['monthly', 'Monthly'],
  ['yearly', 'Yearly'],
];

export function repeatFormFrom(recurrence, dateKey) {
  const rule = normalizeRecurrence(recurrence, dateKey);
  const weekday = dateKey ? weekdayOf(dateKey) : 0;
  const form = {
    preset: 'never',
    byWeekday: [weekday],
    monthlyMode: 'dayOfMonth',
    endMode: 'never',
    until: '',
    count: 10,
    custom: null,
  };
  if (!rule) return form;

  if (rule.until) { form.endMode = 'until'; form.until = rule.until; }
  if (rule.count) { form.endMode = 'count'; form.count = rule.count; }
  if (rule.byWeekday) form.byWeekday = rule.byWeekday;
  if (rule.monthlyMode) form.monthlyMode = rule.monthlyMode;

  const { freq, interval } = rule;
  if (freq === 'daily' && interval === 1) form.preset = 'daily';
  else if (freq === 'weekly' && interval === 1 && rule.byWeekday.join() === '0,1,2,3,4') form.preset = 'weekdays';
  else if (freq === 'weekly' && interval === 1) form.preset = 'weekly';
  else if (freq === 'weekly' && interval === 2) form.preset = 'biweekly';
  else if (freq === 'monthly' && interval === 1) form.preset = 'monthly';
  else if (freq === 'yearly' && interval === 1) form.preset = 'yearly';
  else { form.preset = 'custom'; form.custom = rule; }
  return form;
}

export function recurrenceFromForm(repeat, dateKey) {
  let rule;
  switch (repeat.preset) {
    case 'daily': rule = { freq: 'daily', interval: 1 }; break;
    case 'weekdays': rule = { freq: 'weekly', interval: 1, byWeekday: [0, 1, 2, 3, 4] }; break;
    case 'weekly': rule = { freq: 'weekly', interval: 1, byWeekday: repeat.byWeekday }; break;
    case 'biweekly': rule = { freq: 'weekly', interval: 2, byWeekday: repeat.byWeekday }; break;
    case 'monthly': rule = { freq: 'monthly', interval: 1, monthlyMode: repeat.monthlyMode }; break;
    case 'yearly': rule = { freq: 'yearly', interval: 1 }; break;
    case 'custom': rule = repeat.custom ? { ...repeat.custom } : null; break;
    default: return null;
  }
  if (!rule) return null;
  delete rule.until;
  delete rule.count;
  if (repeat.endMode === 'until' && repeat.until) rule.until = repeat.until;
  if (repeat.endMode === 'count') rule.count = repeat.count;
  return normalizeRecurrence(rule, dateKey);
}

export function repeatError(repeat, dateKey) {
  if (repeat.preset === 'never') return null;
  if (repeat.endMode === 'until' && (!repeat.until || (dateKey && repeat.until < dateKey))) return 'The end date must be on or after the start date.';
  if (repeat.endMode === 'count' && !(Number(repeat.count) >= 1)) return 'Enter how many times it repeats.';
  if ((repeat.preset === 'weekly' || repeat.preset === 'biweekly') && repeat.byWeekday.length === 0) return 'Choose at least one day.';
  return null;
}
