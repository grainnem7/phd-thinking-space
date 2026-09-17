import { useCallback, useEffect, useEffectEvent, useMemo } from 'react';
import { useFirestore } from './useFirestore';
import { useReadingList } from './useReadingList';
import {
  OPEN_TAG_EVENT,
  collectTaggables,
  countTags,
  normalizeTag,
  removeFromList,
  renameInList,
} from '../lib/tags';

// All tags in the workspace with counts, plus rename/delete everywhere.
export function useTags() {
  const { sections, mutateSection } = useFirestore();
  const { papers, updatePaper } = useReadingList();

  const taggables = useMemo(() => collectTaggables(sections, papers), [sections, papers]);
  const tags = useMemo(() => countTags(taggables), [taggables]);

  // Applies `change(tags) -> tags | null` to every note, board, task and paper
  const rewriteTags = useCallback(async (change) => {
    const writes = [];
    for (const s of sections) {
      const sectionTags = s.type === 'note' || s.type === 'board' ? change(s.tags) : null;
      const touchesTasks = s.type === 'board' && (s.tasks || []).some((t) => change(t.tags));
      if (!sectionTags && !touchesTasks) continue;
      // Boards are rewritten from their latest stored copy
      writes.push(mutateSection(s.id, (latest) => {
        const updates = {};
        const nextTags = latest.type === 'note' || latest.type === 'board' ? change(latest.tags) : null;
        if (nextTags) updates.tags = nextTags;
        if (Array.isArray(latest.tasks)) {
          let changed = false;
          const tasks = latest.tasks.map((task) => {
            const next = change(task.tags);
            if (!next) return task;
            changed = true;
            return { ...task, tags: next };
          });
          if (changed) updates.tasks = tasks;
        }
        return updates;
      }));
    }
    for (const p of papers) {
      const next = change(p.tags);
      if (next) writes.push(updatePaper(p.id, { tags: next }));
    }
    const results = await Promise.allSettled(writes);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) {
      failed.forEach((f) => console.error('Tag update failed:', f.reason));
      throw new Error(`${failed.length} ${failed.length === 1 ? 'item' : 'items'} could not be updated`);
    }
  }, [sections, papers, mutateSection, updatePaper]);

  const renameTag = useCallback((from, to) => {
    const target = normalizeTag(to);
    if (!target || target === from) return Promise.resolve();
    return rewriteTags((list) => renameInList(list, from, target));
  }, [rewriteTags]);

  const deleteTag = useCallback((tag) => rewriteTags((list) => removeFromList(list, tag)), [rewriteTags]);

  return { taggables, tags, renameTag, deleteTag };
}

// Tag names for autocomplete, most used first
export function useTagSuggestions() {
  const { sections } = useFirestore();
  const { papers } = useReadingList();
  return useMemo(() => countTags(collectTaggables(sections, papers)).map((t) => t.tag), [sections, papers]);
}

// Opens the Tags view when a tag chip anywhere dispatches OPEN_TAG_EVENT
export function useOpenTagListener(onNavigate) {
  const navigate = useEffectEvent((tag) => {
    onNavigate?.({ id: 'tags', type: 'tags', name: 'Tags', tag: tag || undefined });
  });
  useEffect(() => {
    const handler = (e) => navigate(e.detail?.tag);
    window.addEventListener(OPEN_TAG_EVENT, handler);
    return () => window.removeEventListener(OPEN_TAG_EVENT, handler);
  }, []);
}
