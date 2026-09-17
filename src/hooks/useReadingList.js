import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
  arrayUnion,
  arrayRemove,
  deleteField,
  FieldPath,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from './useAuth';
import { isTrashExpired } from '../lib/sectionTree';

const PAPERS_KEY = 'demo-papers';
const COLLECTIONS_KEY = 'demo-collections';
const EMPTY = [];

// Tabs a paper shows when it has no stored tab list (older documents)
const FALLBACK_TABS = [{ id: 'notes', name: 'Notes' }];

// Default tabs for new papers
const defaultTabs = () => [
  { id: 'notes', name: 'Notes' },
  { id: 'quotes', name: 'Quotes' },
  { id: 'questions', name: 'Questions' },
];

// Ids are used as Firestore field-path segments (tabContent.<id>), so they are
// restricted to [A-Za-z0-9_-]. The random suffix keeps ids created in the same
// millisecond (bulk actions, quick double clicks) distinct.
export function createId(prefix) {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
    : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

// Demo data for papers
const DEMO_PAPERS = [
  {
    id: 'demo-paper-1',
    title: 'Attention Is All You Need',
    authors: 'Vaswani, A., Shazeer, N., Parmar, N., et al.',
    year: 2017,
    url: 'https://arxiv.org/abs/1706.03762',
    doi: '',
    journal: 'Advances in Neural Information Processing Systems',
    status: 'read',
    priority: 'high',
    starred: true,
    collections: ['demo-collection-1'],
    summary: 'Introduces the Transformer architecture, which has become the foundation for modern NLP models.',
    tabs: defaultTabs(),
    tabContent: {
      notes: '# Key Takeaways\n\n- Self-attention mechanism replaces recurrence\n- Parallel processing enables faster training\n- Multi-head attention captures different aspects of relationships',
      quotes: '"We propose a new simple network architecture, the Transformer, based solely on attention mechanisms"',
      questions: '- How does the positional encoding work exactly?\n- What are the limitations of self-attention for very long sequences?'
    },
    createdAt: new Date('2024-01-15').toISOString(),
  },
  {
    id: 'demo-paper-2',
    title: 'Deep Residual Learning for Image Recognition',
    authors: 'He, K., Zhang, X., Ren, S., Sun, J.',
    year: 2016,
    url: 'https://arxiv.org/abs/1512.03385',
    journal: 'CVPR',
    status: 'reading',
    priority: 'medium',
    starred: false,
    collections: ['demo-collection-1'],
    summary: 'Introduces residual connections that enable training of very deep neural networks.',
    tabs: defaultTabs(),
    tabContent: { notes: '', quotes: '', questions: '' },
    createdAt: new Date('2024-01-10').toISOString(),
  },
  {
    id: 'demo-paper-3',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers',
    authors: 'Devlin, J., Chang, M., Lee, K., Toutanova, K.',
    year: 2019,
    url: 'https://arxiv.org/abs/1810.04805',
    journal: 'NAACL',
    status: 'to-read',
    priority: null,
    starred: true,
    collections: ['demo-collection-2'],
    summary: '',
    tabs: defaultTabs(),
    tabContent: { notes: '', quotes: '', questions: '' },
    createdAt: new Date('2024-01-05').toISOString(),
  },
];

const DEMO_COLLECTIONS = [
  { id: 'demo-collection-1', name: 'Deep Learning Foundations' },
  { id: 'demo-collection-2', name: 'NLP Papers' },
];

function readDemo(key, fallback) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key));
    if (Array.isArray(saved)) return saved;
  } catch {
    // Missing or malformed: fall back to the sample data
  }
  return fallback;
}

function writeDemo(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Could not save ${key}:`, e);
  }
}

// Loads demo data, seeding sessionStorage with the samples so that signing in
// later migrates what the visitor saw. Idempotent, so safe in a state initializer.
function loadDemo(key, fallback) {
  const items = readDemo(key, null);
  if (items) return items;
  writeDemo(key, fallback);
  return fallback;
}

// Demo papers, with Trash older than the retention period purged
function loadDemoPapers() {
  const papers = loadDemo(PAPERS_KEY, DEMO_PAPERS);
  const kept = papers.filter((p) => !(p.deletedAt && isTrashExpired(p.deletedAt)));
  if (kept.length !== papers.length) writeDemo(PAPERS_KEY, kept);
  return kept;
}

// Accounts whose expired Trash was already purged this session
const purgedAccounts = new Set();

// Removes a paper document and its attached file for good
async function hardDeletePaper(uid, paperId) {
  const refToDelete = doc(db, 'users', uid, 'papers', paperId);
  const paperSnap = await getDoc(refToDelete);
  const filePath = paperSnap.exists() ? paperSnap.data().file?.path : null;
  if (filePath) {
    try {
      await deleteObject(ref(storage, filePath));
    } catch (fileError) {
      // File might not exist, continue with paper deletion
      if (fileError?.code !== 'storage/object-not-found') console.warn('Could not delete file:', fileError);
    }
  }
  await deleteDoc(refToDelete);
}

function newPaperFields(paperData) {
  const status = paperData.status || 'to-read';
  return {
    title: paperData.title || 'Untitled',
    authors: paperData.authors || '',
    year: paperData.year || null,
    url: paperData.url || '',
    doi: paperData.doi || '',
    // Citation metadata fields
    journal: paperData.journal || '',
    publisher: paperData.publisher || '',
    volume: paperData.volume || '',
    issue: paperData.issue || '',
    pages: paperData.pages || '',
    // Status and organization
    status,
    ...(status === 'read' && { readAt: now() }),
    priority: paperData.priority || null,
    starred: paperData.starred || false,
    collections: paperData.collections || [],
    summary: paperData.summary || '',
    tabs: defaultTabs(),
    tabContent: { notes: '', quotes: '', questions: '' },
  };
}

function now() {
  return new Date().toISOString();
}

export function useReadingList() {
  const { user, isDemo } = useAuth();
  const uid = user?.uid ?? null;

  // Demo mode keeps everything in state mirrored to sessionStorage.
  const [demoPapers, setDemoPapers] = useState(() => (isDemo ? loadDemoPapers() : null));
  const [demoCollections, setDemoCollections] = useState(() => (isDemo ? loadDemo(COLLECTIONS_KEY, DEMO_COLLECTIONS) : null));

  // Firestore snapshots, tagged with the uid they belong to so a stale list is
  // never shown for a different account.
  const [remotePapers, setRemotePapers] = useState({ uid: null, items: EMPTY, error: null });
  const [remoteCollections, setRemoteCollections] = useState({ uid: null, items: EMPTY, error: null });

  useEffect(() => {
    if (!uid || isDemo) return undefined;

    const papersQuery = query(collection(db, 'users', uid, 'papers'), orderBy('createdAt', 'desc'));
    const unsubscribePapers = onSnapshot(
      papersQuery,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRemotePapers({ uid, items, error: null });

        // Once per session: permanently remove Trash older than the retention period
        if (!purgedAccounts.has(uid) && !snapshot.metadata.fromCache) {
          purgedAccounts.add(uid);
          items
            .filter((p) => p.deletedAt && isTrashExpired(p.deletedAt))
            .reduce((chain, p) => chain.then(() => hardDeletePaper(uid, p.id)), Promise.resolve())
            .catch((err) => console.warn('Could not empty expired Trash:', err));
        }
      },
      (error) => {
        console.error('Error subscribing to papers:', error);
        setRemotePapers((prev) => ({ uid, items: prev.uid === uid ? prev.items : EMPTY, error }));
      },
    );

    const collectionsQuery = query(collection(db, 'users', uid, 'paperCollections'), orderBy('name', 'asc'));
    const unsubscribeCollections = onSnapshot(
      collectionsQuery,
      (snapshot) => {
        setRemoteCollections({
          uid,
          items: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
          error: null,
        });
      },
      (error) => {
        console.error('Error subscribing to collections:', error);
        setRemoteCollections((prev) => ({ uid, items: prev.uid === uid ? prev.items : EMPTY, error }));
      },
    );

    return () => {
      unsubscribePapers();
      unsubscribeCollections();
    };
  }, [uid, isDemo]);

  // Demo mode switched on after mount: read (without writing) until the first mutation.
  const demoPapersFallback = useMemo(
    () => (isDemo && !demoPapers ? readDemo(PAPERS_KEY, DEMO_PAPERS) : null),
    [isDemo, demoPapers],
  );
  const demoCollectionsFallback = useMemo(
    () => (isDemo && !demoCollections ? readDemo(COLLECTIONS_KEY, DEMO_COLLECTIONS) : null),
    [isDemo, demoCollections],
  );

  let allPapers = EMPTY;
  let collections = EMPTY;
  let isLoading = false;
  let error = null;
  if (uid && isDemo) {
    allPapers = demoPapers ?? demoPapersFallback;
    collections = demoCollections ?? demoCollectionsFallback;
  } else if (uid) {
    allPapers = remotePapers.uid === uid ? remotePapers.items : EMPTY;
    collections = remoteCollections.uid === uid ? remoteCollections.items : EMPTY;
    isLoading = remotePapers.uid !== uid;
    error = remotePapers.uid === uid ? remotePapers.error : null;
  }

  // Papers in Trash (deletedAt set) are kept apart from the reading list
  const papers = useMemo(() => allPapers.filter((p) => !p.deletedAt), [allPapers]);
  const trashedPapers = useMemo(() => allPapers.filter((p) => p.deletedAt), [allPapers]);

  // Latest lists for use inside async callbacks (never read during render)
  const latest = useRef({ papers: allPapers, collections });
  useEffect(() => {
    latest.current = { papers: allPapers, collections };
  }, [allPapers, collections]);

  // Functional demo updates: every mutation builds on the newest state, so a
  // loop of mutations (bulk actions) applies all of them.
  const mutateDemoPapers = useCallback((fn) => {
    setDemoPapers((prev) => {
      const next = fn(prev ?? readDemo(PAPERS_KEY, DEMO_PAPERS));
      writeDemo(PAPERS_KEY, next);
      return next;
    });
  }, []);

  const mutateDemoCollections = useCallback((fn) => {
    setDemoCollections((prev) => {
      const next = fn(prev ?? readDemo(COLLECTIONS_KEY, DEMO_COLLECTIONS));
      writeDemo(COLLECTIONS_KEY, next);
      return next;
    });
  }, []);

  const mutateDemoPaper = useCallback((paperId, fn) => {
    mutateDemoPapers((prev) => prev.map((p) => (
      p.id === paperId ? { ...fn(p), updatedAt: now() } : p
    )));
  }, [mutateDemoPapers]);

  const paperRef = useCallback((paperId) => doc(db, 'users', uid, 'papers', paperId), [uid]);

  // All mutations throw on failure so the UI can show an inline error.
  const requireUser = useCallback(() => {
    if (!uid) throw new Error('You need to be signed in to change your reading list.');
  }, [uid]);

  // Add paper with new data model
  const addPaper = useCallback(async (paperData) => {
    requireUser();

    if (isDemo) {
      const newId = createId('demo-paper');
      // Demo papers never carry files: uploads are refused in demo mode.
      const newPaper = { id: newId, ...newPaperFields(paperData), createdAt: now(), updatedAt: now() };
      mutateDemoPapers((prev) => [newPaper, ...prev]);
      return newId;
    }

    const docRef = await addDoc(collection(db, 'users', uid, 'papers'), {
      ...newPaperFields(paperData),
      ...(paperData.file && { file: paperData.file }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }, [uid, isDemo, requireUser, mutateDemoPapers]);

  // Update top-level paper fields. A status change to 'read' records readAt
  // (ISO string); changing away from 'read' clears it.
  const updatePaper = useCallback(async (paperId, updates) => {
    requireUser();
    const statusChanged = Object.prototype.hasOwnProperty.call(updates, 'status');

    if (isDemo) {
      mutateDemoPaper(paperId, (p) => {
        const next = { ...p, ...updates };
        if (statusChanged && updates.status === 'read' && p.status !== 'read') next.readAt = now();
        if (statusChanged && updates.status !== 'read') delete next.readAt;
        return next;
      });
      return;
    }

    const current = latest.current.papers.find((p) => p.id === paperId);
    let readAt = {};
    if (statusChanged && updates.status === 'read' && current?.status !== 'read') readAt = { readAt: now() };
    if (statusChanged && updates.status !== 'read' && current?.readAt !== undefined) readAt = { readAt: deleteField() };

    await updateDoc(paperRef(paperId), {
      ...updates,
      ...readAt,
      updatedAt: serverTimestamp(),
    });
  }, [isDemo, requireUser, mutateDemoPaper, paperRef]);

  // Add or remove one collection label without rewriting the whole array
  const setPaperCollection = useCallback(async (paperId, collectionId, included) => {
    requireUser();

    if (isDemo) {
      mutateDemoPaper(paperId, (p) => {
        const current = (p.collections || []).filter((c) => c !== collectionId);
        return { ...p, collections: included ? [...current, collectionId] : current };
      });
      return;
    }

    await updateDoc(paperRef(paperId), {
      collections: included ? arrayUnion(collectionId) : arrayRemove(collectionId),
      updatedAt: serverTimestamp(),
    });
  }, [isDemo, requireUser, mutateDemoPaper, paperRef]);

  // Move a paper to Trash (its attached file is kept until it's deleted for good)
  const deletePaper = useCallback(async (paperId) => {
    requireUser();
    const deletedAt = now();

    if (isDemo) {
      mutateDemoPaper(paperId, (p) => ({ ...p, deletedAt }));
      return;
    }

    await updateDoc(paperRef(paperId), { deletedAt, updatedAt: serverTimestamp() });
  }, [isDemo, requireUser, mutateDemoPaper, paperRef]);

  const restorePaper = useCallback(async (paperId) => {
    requireUser();

    if (isDemo) {
      mutateDemoPaper(paperId, ({ deletedAt, ...rest }) => rest);
      return;
    }

    await updateDoc(paperRef(paperId), { deletedAt: deleteField(), updatedAt: serverTimestamp() });
  }, [isDemo, requireUser, mutateDemoPaper, paperRef]);

  // Permanently delete a paper and its attached file
  const deletePaperForever = useCallback(async (paperId) => {
    requireUser();

    if (isDemo) {
      mutateDemoPapers((prev) => prev.filter((p) => p.id !== paperId));
      return;
    }

    await hardDeletePaper(uid, paperId);
  }, [uid, isDemo, requireUser, mutateDemoPapers]);

  // Add collection (returns the existing id if the name is taken)
  const addCollection = useCallback(async (name) => {
    requireUser();
    const trimmed = name.trim();
    const sameName = (c) => c.name.toLowerCase() === trimmed.toLowerCase();

    const existing = latest.current.collections.find(sameName);
    if (existing) return existing.id;

    if (isDemo) {
      const newId = createId('demo-collection');
      mutateDemoCollections((prev) => (prev.some(sameName) ? prev : [...prev, { id: newId, name: trimmed }]));
      return newId;
    }

    const docRef = await addDoc(collection(db, 'users', uid, 'paperCollections'), {
      name: trimmed,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }, [uid, isDemo, requireUser, mutateDemoCollections]);

  // Update collection
  const updateCollection = useCallback(async (collectionId, updates) => {
    requireUser();

    if (isDemo) {
      mutateDemoCollections((prev) => prev.map((c) => (c.id === collectionId ? { ...c, ...updates } : c)));
      return;
    }

    await updateDoc(doc(db, 'users', uid, 'paperCollections', collectionId), updates);
  }, [uid, isDemo, requireUser, mutateDemoCollections]);

  // Delete collection and remove its label from every paper
  const deleteCollection = useCallback(async (collectionId) => {
    requireUser();

    if (isDemo) {
      mutateDemoCollections((prev) => prev.filter((c) => c.id !== collectionId));
      mutateDemoPapers((prev) => prev.map((p) => (
        p.collections?.includes(collectionId)
          ? { ...p, collections: p.collections.filter((c) => c !== collectionId) }
          : p
      )));
      return;
    }

    await deleteDoc(doc(db, 'users', uid, 'paperCollections', collectionId));
    const labelled = await getDocs(query(
      collection(db, 'users', uid, 'papers'),
      where('collections', 'array-contains', collectionId),
    ));
    await Promise.all(labelled.docs.map((d) => updateDoc(d.ref, {
      collections: arrayRemove(collectionId),
      updatedAt: serverTimestamp(),
    })));
  }, [uid, isDemo, requireUser, mutateDemoCollections, mutateDemoPapers]);

  // ---- Tabs ---------------------------------------------------------------
  // Tab notes are written one field at a time (tabContent.<tabId>) so edits to
  // different tabs, from different devices, never overwrite each other. Tab
  // list changes are computed from the latest stored document.

  // Pass `tabId` (from createId('tab')) to know the id before the write settles.
  const addTab = useCallback(async (paperId, tabName = 'New Tab', tabId = createId('tab')) => {
    requireUser();
    const newTab = { id: tabId, name: tabName };

    if (isDemo) {
      mutateDemoPaper(paperId, (p) => ({
        ...p,
        tabs: [...(p.tabs || FALLBACK_TABS), newTab],
        tabContent: { ...(p.tabContent || {}), [newTab.id]: '' },
      }));
      return newTab.id;
    }

    // Tab ids are unique, so arrayUnion appends without touching tabs added or
    // renamed elsewhere. Papers without a stored tab list get the fallback too.
    const paper = latest.current.papers.find((p) => p.id === paperId);
    const tabsValue = Array.isArray(paper?.tabs) ? arrayUnion(newTab) : [...FALLBACK_TABS, newTab];
    await updateDoc(
      paperRef(paperId),
      'tabs', tabsValue,
      new FieldPath('tabContent', newTab.id), '',
      'updatedAt', serverTimestamp(),
    );
    return newTab.id;
  }, [isDemo, requireUser, mutateDemoPaper, paperRef]);

  const renameTab = useCallback(async (paperId, tabId, newName) => {
    requireUser();
    const rename = (tabs) => tabs.map((tab) => (tab.id === tabId ? { ...tab, name: newName } : tab));

    if (isDemo) {
      mutateDemoPaper(paperId, (p) => ({ ...p, tabs: rename(p.tabs || FALLBACK_TABS) }));
      return;
    }

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(paperRef(paperId));
      if (!snap.exists()) throw new Error('This paper no longer exists.');
      tx.update(paperRef(paperId), {
        tabs: rename(snap.data().tabs || FALLBACK_TABS),
        updatedAt: serverTimestamp(),
      });
    });
  }, [isDemo, requireUser, mutateDemoPaper, paperRef]);

  const deleteTab = useCallback(async (paperId, tabId) => {
    requireUser();

    if (isDemo) {
      mutateDemoPaper(paperId, (p) => {
        const tabs = p.tabs || FALLBACK_TABS;
        if (tabs.length <= 1) return p;
        const tabContent = { ...(p.tabContent || {}) };
        delete tabContent[tabId];
        return { ...p, tabs: tabs.filter((tab) => tab.id !== tabId), tabContent };
      });
      return;
    }

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(paperRef(paperId));
      if (!snap.exists()) return;
      const tabs = snap.data().tabs || FALLBACK_TABS;
      if (tabs.length <= 1) return;
      tx.update(
        paperRef(paperId),
        'tabs', tabs.filter((tab) => tab.id !== tabId),
        new FieldPath('tabContent', tabId), deleteField(),
        'updatedAt', serverTimestamp(),
      );
    });
  }, [isDemo, requireUser, mutateDemoPaper, paperRef]);

  const updateTabContent = useCallback(async (paperId, tabId, content) => {
    requireUser();

    if (isDemo) {
      mutateDemoPaper(paperId, (p) => ({ ...p, tabContent: { ...(p.tabContent || {}), [tabId]: content } }));
      return;
    }

    await updateDoc(
      paperRef(paperId),
      new FieldPath('tabContent', tabId), content,
      'updatedAt', serverTimestamp(),
    );
  }, [isDemo, requireUser, mutateDemoPaper, paperRef]);

  // Appends BlockNote blocks to the tab called `tabName` (created if missing),
  // reading the tab's latest stored content. Returns the tab id.
  const appendToTab = useCallback(async (paperId, tabName, blocks) => {
    requireUser();
    const newTabId = createId('tab');

    const plan = (data) => {
      const tabs = data.tabs || FALLBACK_TABS;
      const found = tabs.find((t) => t.name.trim().toLowerCase() === tabName.toLowerCase());
      const tab = found || { id: newTabId, name: tabName };
      let existing = [];
      try {
        const parsed = JSON.parse(data.tabContent?.[tab.id] || '[]');
        if (Array.isArray(parsed)) existing = parsed;
      } catch {
        // Legacy Markdown/plain text: keep it as a paragraph above the new blocks
        existing = [{
          type: 'paragraph',
          content: [{ type: 'text', text: data.tabContent[tab.id], styles: {} }],
          children: [],
        }];
      }
      return {
        tab,
        tabs: found ? null : [...tabs, tab],
        content: JSON.stringify([...existing, ...blocks]),
      };
    };

    if (isDemo) {
      mutateDemoPaper(paperId, (p) => {
        const next = plan(p);
        return {
          ...p,
          ...(next.tabs && { tabs: next.tabs }),
          tabContent: { ...(p.tabContent || {}), [next.tab.id]: next.content },
        };
      });
      // The updater may run later, but it computes the same result from the
      // same stored paper (an existing tab by name, or `newTabId`).
      const stored = readDemo(PAPERS_KEY, DEMO_PAPERS).find((p) => p.id === paperId);
      if (!stored) throw new Error('This paper no longer exists.');
      return plan(stored).tab.id;
    }

    return runTransaction(db, async (tx) => {
      const snap = await tx.get(paperRef(paperId));
      if (!snap.exists()) throw new Error('This paper no longer exists.');
      const next = plan(snap.data());
      const fields = [new FieldPath('tabContent', next.tab.id), next.content, 'updatedAt', serverTimestamp()];
      if (next.tabs) fields.push('tabs', next.tabs);
      tx.update(paperRef(paperId), ...fields);
      return next.tab.id;
    });
  }, [isDemo, requireUser, mutateDemoPaper, paperRef]);

  // Get papers by status
  const getPapersByStatus = useCallback((status) => {
    if (status === 'all') return papers;
    return papers.filter(p => p.status === status);
  }, [papers]);

  // Get papers by collection
  const getPapersByCollection = useCallback((collectionId) => {
    if (!collectionId || collectionId === 'all') return papers;
    return papers.filter(p => p.collections?.includes(collectionId));
  }, [papers]);

  // Get counts by status
  const getCounts = useCallback(() => {
    return {
      'to-read': papers.filter(p => (p.status || 'to-read') === 'to-read').length,
      'reading': papers.filter(p => p.status === 'reading').length,
      'read': papers.filter(p => p.status === 'read').length,
      'all': papers.length,
    };
  }, [papers]);

  // Get starred papers
  const getStarredPapers = useCallback(() => {
    return papers.filter(p => p.starred);
  }, [papers]);

  return {
    papers,
    trashedPapers,
    collections,
    isLoading,
    error,
    addPaper,
    updatePaper,
    setPaperCollection,
    deletePaper,
    restorePaper,
    deletePaperForever,
    addCollection,
    updateCollection,
    deleteCollection,
    addTab,
    renameTab,
    deleteTab,
    updateTabContent,
    appendToTab,
    getPapersByStatus,
    getPapersByCollection,
    getCounts,
    getStarredPapers,
  };
}
