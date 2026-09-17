import { useCallback } from 'react';
import {
  addDaysToKey, daysBetween, countOccurrencesBefore, normalizeRecurrence, sameRecurrence,
  shiftRecurrence, splitRecurrence,
} from '../../lib/recurrence';

// Fields that belong to one stored event document rather than to its content
const NON_CONTENT = new Set([
  'id', 'createdAt', 'updatedAt', 'recurrence', 'exdates', 'recurringEventId', 'originalDate',
  'source', 'seriesId', 'occurrenceDate', 'span', 'category',
]);

export function contentFields(item) {
  const out = {};
  for (const [key, value] of Object.entries(item || {})) {
    if (!NON_CONTENT.has(key) && value !== undefined) out[key] = value;
  }
  return out;
}

const uniqSorted = (list) => [...new Set(list)].sort();

// Runs writes while remembering how to reverse them (used for "Undo").
function createRecorder(items, { addItem, updateItem, deleteItem }) {
  const reversers = [];
  return {
    async update(id, data) {
      const prev = items.find((i) => i.id === id) || {};
      const restore = {};
      for (const key of Object.keys(data)) {
        if (key === 'exdates') restore[key] = prev.exdates ?? [];
        else restore[key] = prev[key] ?? null;
      }
      reversers.push(() => updateItem(id, restore));
      await updateItem(id, data);
    },
    async add(data) {
      const id = await addItem(data);
      if (id) reversers.push(() => deleteItem(id));
      return id;
    },
    remove: (id) => deleteItem(id),
    undo: async () => {
      for (const reverse of reversers.reverse()) await reverse();
    },
  };
}

// Edits, moves and deletes of calendar events, including single occurrences of
// repeating series with the scopes 'this' | 'following' | 'all'. Each write-action
// resolves to an undo function.
export function useSeriesActions({ items, addItem, updateItem, deleteItem }) {
  // entry: a calendar entry (plain event or occurrence). date: its new date.
  // changes: content fields to apply. recurrence: new rule from the editor
  // (undefined = keep; null = stop repeating).
  const changeEvent = useCallback(async ({ entry, scope = 'all', date, changes = {}, recurrence }) => {
    const rec = createRecorder(items, { addItem, updateItem, deleteItem });
    const targetDate = date || entry.date;

    if (!entry.seriesId) {
      const data = { ...changes, date: targetDate };
      if (recurrence !== undefined) {
        data.recurrence = normalizeRecurrence(recurrence, targetDate);
        if (data.recurrence && !entry.exdates) data.exdates = [];
      }
      await rec.update(entry.id, data);
      return rec.undo;
    }

    const series = items.find((i) => i.id === entry.seriesId);
    if (!series) return rec.undo;
    const occ = entry.occurrenceDate;
    const delta = daysBetween(occ, targetDate);
    const exdates = series.exdates || [];
    const recChanged = recurrence !== undefined && !sameRecurrence(recurrence, series.recurrence, occ);
    let effective = scope;
    if (effective === 'following' && countOccurrencesBefore(series, occ) === 0) effective = 'all';

    if (effective === 'this') {
      await rec.update(series.id, { exdates: uniqSorted([...exdates, occ]) });
      await rec.add({
        ...contentFields(series), ...changes, kind: 'event', date: targetDate,
        recurrence: null, recurringEventId: series.id, originalDate: occ,
      });
    } else if (effective === 'all') {
      if (recChanged && !recurrence) {
        await rec.update(series.id, { ...changes, date: targetDate, recurrence: null, exdates: [] });
      } else {
        const start = addDaysToKey(series.date, delta);
        await rec.update(series.id, {
          ...changes,
          date: start,
          recurrence: recChanged ? normalizeRecurrence(recurrence, targetDate) : shiftRecurrence(series.recurrence, delta, series.date),
          exdates: exdates.map((d) => addDaysToKey(d, delta)),
        });
      }
    } else {
      const { before, after } = splitRecurrence(series, occ);
      await rec.update(series.id, { recurrence: before, exdates: exdates.filter((d) => d < occ) });
      const nextRule = recChanged
        ? normalizeRecurrence(recurrence, targetDate)
        : shiftRecurrence(after, delta, occ);
      const newId = await rec.add({
        ...contentFields(series), ...changes, kind: 'event', date: targetDate,
        recurrence: nextRule,
        exdates: nextRule ? exdates.filter((d) => d >= occ).map((d) => addDaysToKey(d, delta)) : [],
      });
      if (newId) {
        const overrides = items.filter((i) => i.recurringEventId === series.id && i.originalDate >= occ);
        for (const o of overrides) await rec.update(o.id, { recurringEventId: newId });
      }
    }
    return rec.undo;
  }, [items, addItem, updateItem, deleteItem]);

  const deleteEvent = useCallback(async (entry, scope = 'all') => {
    const rec = createRecorder(items, { addItem, updateItem, deleteItem });
    if (!entry.seriesId) {
      await rec.remove(entry.id);
      return;
    }
    const series = items.find((i) => i.id === entry.seriesId);
    if (!series) return;
    const occ = entry.occurrenceDate;
    const overrides = items.filter((i) => i.recurringEventId === series.id);
    let effective = scope;
    if (effective === 'following' && countOccurrencesBefore(series, occ) === 0) effective = 'all';

    if (effective === 'this') {
      await rec.update(series.id, { exdates: uniqSorted([...(series.exdates || []), occ]) });
    } else if (effective === 'following') {
      const { before } = splitRecurrence(series, occ);
      await rec.update(series.id, { recurrence: before, exdates: (series.exdates || []).filter((d) => d < occ) });
      for (const o of overrides.filter((i) => i.originalDate >= occ)) await rec.remove(o.id);
    } else {
      await rec.remove(series.id);
      for (const o of overrides) await rec.remove(o.id);
    }
  }, [items, addItem, updateItem, deleteItem]);

  // A standalone copy of an event (or of one occurrence) on the same day
  const duplicateEvent = useCallback(async (entry) => {
    const raw = items.find((i) => i.id === (entry.seriesId || entry.id)) || entry;
    return addItem({ ...contentFields(raw), kind: 'event', date: entry.date, recurrence: null });
  }, [items, addItem]);

  return { changeEvent, deleteEvent, duplicateEvent };
}
