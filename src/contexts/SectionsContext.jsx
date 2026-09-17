import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  runTransaction,
  deleteField,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { defaultSections, defaultBoardColumns, BATCH_LIMIT } from '../lib/defaults';
import { subtreeIds, canMoveSection, childrenOf, isTrashExpired } from '../lib/sectionTree';

// One shared copy of the notes/boards/folders tree. Every screen reads and
// writes through this provider, so demo-mode state can't diverge between
// components and mutations always start from the latest data.
//
// Deleting is a soft delete: the item and its descendants get `deletedAt` and
// `trashRootId` (the id the user deleted) and move to Trash, where they can be
// restored for 30 days. `sections` never includes trashed items.

const DEMO_KEY = 'demo-sections';

const DEMO_SECTIONS = [
  { id: 'demo-notes', name: 'Research Notes', icon: 'folder', order: 0, parentId: null, type: 'folder' },
  {
    id: 'demo-note-1',
    name: 'Literature Review',
    icon: 'file',
    order: 0,
    parentId: 'demo-notes',
    type: 'note',
    content: '# Literature Review\n\nThis is an example note demonstrating the rich text editor.\n\n## Key Findings\n\n- Finding 1: Lorem ipsum dolor sit amet\n- Finding 2: Consectetur adipiscing elit\n- Finding 3: Sed do eiusmod tempor incididunt\n\n## Next Steps\n\n1. Review additional papers\n2. Synthesize findings\n3. Draft methodology section',
  },
  {
    id: 'demo-note-2',
    name: 'Meeting Notes',
    icon: 'file',
    order: 1,
    parentId: 'demo-notes',
    type: 'note',
    content: '# Meeting Notes\n\n**Attendees:** Supervisor, Research Team\n\n## Discussion Points\n\n- Project timeline review\n- Budget allocation\n- New collaboration opportunities\n\n## Action Items\n\n- Submit grant proposal\n- Schedule follow-up meeting\n- Review draft chapters',
  },
  {
    id: 'demo-tasks',
    name: 'PhD Tasks',
    icon: 'kanban',
    order: 1,
    parentId: null,
    type: 'board',
    columns: defaultBoardColumns(),
    tasks: [
      { id: 'task-1', title: 'Write Chapter 3 draft', columnId: 'in-progress', order: 0, description: 'Complete first draft of methodology chapter' },
      { id: 'task-2', title: 'Submit IRB application', columnId: 'todo', order: 0, description: 'Prepare and submit ethics approval' },
      { id: 'task-3', title: 'Literature search', columnId: 'done', order: 0, description: 'Complete systematic review search' },
      { id: 'task-4', title: 'Advisor meeting prep', columnId: 'todo', order: 1, description: 'Prepare slides for next meeting' },
      { id: 'task-5', title: 'Data collection plan', columnId: 'in-progress', order: 1, description: 'Finalize participant recruitment strategy' },
    ],
  },
  {
    id: 'demo-ideas',
    name: 'Research Ideas',
    icon: 'file',
    order: 2,
    parentId: null,
    type: 'note',
    content: '# Research Ideas\n\n## Potential Topics\n\n1. **Machine Learning in Education**\n   - Personalized learning paths\n   - Automated assessment\n\n2. **Human-Computer Interaction**\n   - Accessibility improvements\n   - User experience research\n\n## Questions to Explore\n\n- How can AI improve student outcomes?\n- What are the ethical implications?\n- How do we measure success?',
  },
];

function loadDemoSections() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DEMO_KEY));
    if (Array.isArray(saved)) {
      // Trash older than the retention period is purged when the session starts
      const kept = saved.filter((s) => !(s.deletedAt && isTrashExpired(s.deletedAt)));
      if (kept.length !== saved.length) sessionStorage.setItem(DEMO_KEY, JSON.stringify(kept));
      return kept;
    }
  } catch { /* ignore */ }
  sessionStorage.setItem(DEMO_KEY, JSON.stringify(DEMO_SECTIONS));
  return DEMO_SECTIONS;
}

// Accounts whose expired Trash was already purged this session
const purgedAccounts = new Set();

const trashRootOf = (s) => s.trashRootId ?? s.id;
const liveOf = (list) => list.filter((s) => !s.deletedAt);

function withoutTrashFields(section) {
  const { deletedAt, trashRootId, ...rest } = section;
  return rest;
}

async function commitInChunks(ops) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    await batch.commit();
  }
}

const SectionsContext = createContext(null);

export function SectionsProvider({ children }) {
  const { user, isDemo } = useAuth();
  // Every stored item, including trashed ones
  const [allSections, setAllSections] = useState(() => (isDemo ? loadDemoSections() : []));
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState(null);
  const sectionsRef = useRef(allSections);
  useEffect(() => { sectionsRef.current = allSections; }, [allSections]);

  useEffect(() => {
    if (!user || isDemo) return;

    const uid = user.uid;
    const q = query(collection(db, 'users', uid, 'sections'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const next = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      sectionsRef.current = next;
      setAllSections(next);
      setError(null);
      setLoading(false);

      // Once per session: permanently remove Trash older than the retention period
      if (!purgedAccounts.has(uid) && !snapshot.metadata.fromCache) {
        purgedAccounts.add(uid);
        const expired = next.filter((s) => s.deletedAt && isTrashExpired(s.deletedAt));
        if (expired.length) {
          commitInChunks(expired.map((s) => (batch) => batch.delete(doc(db, 'users', uid, 'sections', s.id))))
            .catch((err) => console.warn('Could not empty expired Trash:', err));
        }
      }
    }, (err) => {
      console.error('Error loading sections:', err);
      setError(err);
      setLoading(false);
    });
    return unsubscribe;
  }, [user, isDemo]);

  // Demo mode: apply an updater to the latest state and mirror it to sessionStorage
  const updateDemo = useCallback((fn) => {
    setAllSections((prev) => {
      const next = fn(prev);
      sectionsRef.current = next;
      sessionStorage.setItem(DEMO_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const sectionsCollection = useCallback(() => collection(db, 'users', user.uid, 'sections'), [user]);
  const sectionDoc = useCallback((id) => doc(db, 'users', user.uid, 'sections', id), [user]);

  const addSection = useCallback(async (sectionData) => {
    if (!user) return;

    if (isDemo) {
      const newId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();
      updateDemo((prev) => [...prev, { id: newId, ...sectionData, createdAt: now, updatedAt: now }]);
      return newId;
    }

    const docRef = await addDoc(sectionsCollection(), {
      ...sectionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }, [user, isDemo, updateDemo, sectionsCollection]);

  const updateSection = useCallback(async (sectionId, updates) => {
    if (!user) return;

    if (isDemo) {
      const now = new Date().toISOString();
      updateDemo((prev) => prev.map((s) => (s.id === sectionId ? { ...s, ...updates, updatedAt: now } : s)));
      return;
    }

    await updateDoc(sectionDoc(sectionId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }, [user, isDemo, updateDemo, sectionDoc]);

  // Read-modify-write a single section from its latest stored value. Used for
  // boards, whose tasks/columns are arrays: a transaction stops two devices or
  // tabs from silently overwriting each other's changes. Offline, transactions
  // can't run, so fall back to the latest locally cached copy.
  const mutateSection = useCallback(async (sectionId, updater) => {
    if (!user) return;

    if (isDemo) {
      const now = new Date().toISOString();
      updateDemo((prev) => prev.map((s) => (s.id === sectionId ? { ...s, ...updater(s), updatedAt: now } : s)));
      return;
    }

    const ref = sectionDoc(sectionId);
    const applyLocal = async () => {
      const current = sectionsRef.current.find((s) => s.id === sectionId);
      if (!current) return;
      await updateDoc(ref, { ...updater(current), updatedAt: serverTimestamp() });
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await applyLocal();
      return;
    }

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        tx.update(ref, { ...updater({ id: snap.id, ...snap.data() }), updatedAt: serverTimestamp() });
      });
    } catch (err) {
      if (err?.code === 'unavailable' || err?.code === 'failed-precondition') {
        await applyLocal();
      } else {
        throw err;
      }
    }
  }, [user, isDemo, updateDemo, sectionDoc]);

  // Move an item and everything inside it to Trash
  const deleteSection = useCallback(async (sectionId) => {
    if (!user) return;
    const live = liveOf(sectionsRef.current);
    if (!live.some((s) => s.id === sectionId)) return;
    const ids = subtreeIds(live, sectionId);
    const deletedAt = new Date().toISOString();

    if (isDemo) {
      const idSet = new Set(ids);
      updateDemo((prev) => prev.map((s) => (idSet.has(s.id) ? { ...s, deletedAt, trashRootId: sectionId, updatedAt: deletedAt } : s)));
      return;
    }

    await commitInChunks(ids.map((id) => (batch) => batch.update(sectionDoc(id), {
      deletedAt,
      trashRootId: sectionId,
      updatedAt: serverTimestamp(),
    })));
  }, [user, isDemo, updateDemo, sectionDoc]);

  // Restore everything deleted together with rootId. If the folder it was in
  // is gone (or itself in Trash), the item comes back at the top level.
  const restoreSection = useCallback(async (rootId) => {
    if (!user) return;
    const all = sectionsRef.current;
    const items = all.filter((s) => s.deletedAt && trashRootOf(s) === rootId);
    if (items.length === 0) return;

    const root = all.find((s) => s.id === rootId);
    const parent = root?.parentId != null ? all.find((s) => s.id === root.parentId) : null;
    const toTopLevel = root?.parentId != null && (!parent || Boolean(parent.deletedAt));
    const rootOrder = toTopLevel ? childrenOf(liveOf(sectionsRef.current), null).length : null;
    const ids = new Set(items.map((s) => s.id));

    if (isDemo) {
      const now = new Date().toISOString();
      updateDemo((prev) => prev.map((s) => {
        if (!ids.has(s.id)) return s;
        const restored = { ...withoutTrashFields(s), updatedAt: now };
        return s.id === rootId && toTopLevel ? { ...restored, parentId: null, order: rootOrder } : restored;
      }));
      return;
    }

    await commitInChunks(items.map((s) => (batch) => batch.update(sectionDoc(s.id), {
      deletedAt: deleteField(),
      trashRootId: deleteField(),
      updatedAt: serverTimestamp(),
      ...(s.id === rootId && toTopLevel && { parentId: null, order: rootOrder }),
    })));
  }, [user, isDemo, updateDemo, sectionDoc]);

  // Permanently delete everything deleted together with rootId
  const deleteSectionForever = useCallback(async (rootId) => {
    if (!user) return;
    const ids = sectionsRef.current.filter((s) => s.deletedAt && trashRootOf(s) === rootId).map((s) => s.id);
    if (ids.length === 0) return;

    if (isDemo) {
      const idSet = new Set(ids);
      updateDemo((prev) => prev.filter((s) => !idSet.has(s.id)));
      return;
    }

    await commitInChunks(ids.map((id) => (batch) => batch.delete(sectionDoc(id))));
  }, [user, isDemo, updateDemo, sectionDoc]);

  const emptyTrash = useCallback(async () => {
    if (!user) return;
    const ids = sectionsRef.current.filter((s) => s.deletedAt).map((s) => s.id);
    if (ids.length === 0) return;

    if (isDemo) {
      updateDemo((prev) => prev.filter((s) => !s.deletedAt));
      return;
    }

    await commitInChunks(ids.map((id) => (batch) => batch.delete(sectionDoc(id))));
  }, [user, isDemo, updateDemo, sectionDoc]);

  // Move an item into a folder (null = top level), at `index` among its new
  // siblings or at the end. Returns false when the move isn't allowed (into
  // itself, one of its descendants, or something that isn't a folder).
  const moveSection = useCallback(async (sectionId, newParentId = null, index) => {
    if (!user) return false;
    const live = liveOf(sectionsRef.current);
    const parentId = newParentId ?? null;
    if (!canMoveSection(live, sectionId, parentId)) return false;

    const item = live.find((s) => s.id === sectionId);
    const oldParentId = item.parentId ?? null;
    const destination = childrenOf(live, parentId).filter((s) => s.id !== sectionId);
    const at = index == null ? destination.length : Math.max(0, Math.min(index, destination.length));
    destination.splice(at, 0, item);

    const updates = new Map();
    destination.forEach((s, i) => {
      if (s.id === sectionId) {
        if (oldParentId !== parentId || s.order !== i) updates.set(s.id, { parentId, order: i });
      } else if (s.order !== i) {
        updates.set(s.id, { order: i });
      }
    });
    if (oldParentId !== parentId) {
      childrenOf(live, oldParentId)
        .filter((s) => s.id !== sectionId)
        .forEach((s, i) => { if (s.order !== i) updates.set(s.id, { order: i }); });
    }
    if (updates.size === 0) return true;

    if (isDemo) {
      const now = new Date().toISOString();
      updateDemo((prev) => prev.map((s) => (updates.has(s.id) ? { ...s, ...updates.get(s.id), updatedAt: now } : s)));
      return true;
    }

    await commitInChunks([...updates].map(([id, fields]) => (batch) => batch.update(sectionDoc(id), {
      ...fields,
      updatedAt: serverTimestamp(),
    })));
    return true;
  }, [user, isDemo, updateDemo, sectionDoc]);

  const duplicateSection = useCallback(async (sectionId) => {
    if (!user) return;
    const section = sectionsRef.current.find((s) => s.id === sectionId);
    if (!section) return;

    const { id, createdAt, updatedAt, ...sectionData } = withoutTrashFields(section);
    return addSection({
      ...sectionData,
      name: `${section.name} (copy)`,
      order: (section.order || 0) + 0.5,
    });
  }, [user, addSection]);

  const reorderSections = useCallback(async (reorderedSections) => {
    if (!user) return;

    if (isDemo) {
      const orderById = new Map(reorderedSections.map((s, index) => [s.id, index]));
      const now = new Date().toISOString();
      updateDemo((prev) => prev.map((s) => (orderById.has(s.id) ? { ...s, order: orderById.get(s.id), updatedAt: now } : s)));
      return;
    }

    await commitInChunks(reorderedSections.map((section, index) => (batch) =>
      batch.update(sectionDoc(section.id), { order: index, updatedAt: serverTimestamp() })
    ));
  }, [user, isDemo, updateDemo, sectionDoc]);

  const resetToDefaults = useCallback(async () => {
    if (!user) return;

    if (isDemo) {
      updateDemo(() => DEMO_SECTIONS);
      return;
    }

    const coll = sectionsCollection();
    await commitInChunks([
      ...sectionsRef.current.map((s) => (batch) => batch.delete(doc(coll, s.id))),
      ...defaultSections().map((s) => (batch) => batch.set(doc(coll), {
        ...s,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })),
    ]);
  }, [user, isDemo, updateDemo, sectionsCollection]);

  const sections = useMemo(() => allSections.filter((s) => !s.deletedAt), [allSections]);
  const trashedSections = useMemo(() => allSections.filter((s) => s.deletedAt), [allSections]);

  const value = useMemo(() => ({
    sections: user ? sections : [],
    trashedSections: user ? trashedSections : [],
    loading: Boolean(user) && !isDemo && loading,
    error,
    addSection,
    updateSection,
    mutateSection,
    deleteSection,
    restoreSection,
    deleteSectionForever,
    emptyTrash,
    moveSection,
    duplicateSection,
    reorderSections,
    resetToDefaults,
  }), [user, isDemo, sections, trashedSections, loading, error, addSection, updateSection, mutateSection, deleteSection, restoreSection, deleteSectionForever, emptyTrash, moveSection, duplicateSection, reorderSections, resetToDefaults]);

  return <SectionsContext.Provider value={value}>{children}</SectionsContext.Provider>;
}

export function useSections() {
  const context = useContext(SectionsContext);
  if (!context) throw new Error('useSections must be used within a SectionsProvider');
  return context;
}
