import { useCallback, useEffect, useRef } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import { useWritingStats } from '../../hooks/useWritingStats';
import { contentToText, countWords } from '../../lib/noteText';

// At most one snapshot per 10s while notes are changing
const DELAY_MS = 10000;

// Records today's total word count across all notes into the writing stats.
// Mounted once in the signed-in app shell; renders nothing.
export default function WritingStatsRecorder() {
  const { sections, loading, error } = useFirestore();
  const { recordTotal, loaded, snapshots } = useWritingStats();
  const ready = loaded && !loading && !error;

  const latest = useRef({ sections, ready: false, recordTotal, hasSnapshots: false });
  // note id -> { content, words }, so unchanged notes aren't re-counted
  const wordCache = useRef(new Map());
  const timer = useRef(null);

  useEffect(() => {
    latest.current = { sections, ready, recordTotal, hasSnapshots: snapshots.length > 0 };
  }, [sections, ready, recordTotal, snapshots.length]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;
    const { sections: current, ready: canRecord, recordTotal: record, hasSnapshots } = latest.current;
    if (!canRecord) return;

    const cache = wordCache.current;
    const seen = new Set();
    let total = 0;
    for (const s of current) {
      if (s.type !== 'note') continue;
      seen.add(s.id);
      let entry = cache.get(s.id);
      if (!entry || entry.content !== s.content) {
        entry = { content: s.content, words: countWords(contentToText(s.content)) };
        cache.set(s.id, entry);
      }
      total += entry.words;
    }
    for (const id of cache.keys()) if (!seen.has(id)) cache.delete(id);

    // Don't start tracking from an empty workspace
    if (total === 0 && !hasSnapshots) return;
    record(total);
  }, []);

  // Notes changed (or data finished loading): record shortly
  useEffect(() => {
    if (!ready || timer.current) return;
    timer.current = setTimeout(flush, DELAY_MS);
  }, [sections, ready, flush]);

  // Leaving the tab or page: record straight away
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      if (timer.current) flush();
    };
  }, [flush]);

  return null;
}
