import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from './useAuth';

// Default tabs for new papers
const defaultTabs = [
  { id: 'notes', name: 'Notes' },
  { id: 'quotes', name: 'Quotes' },
  { id: 'questions', name: 'Questions' },
];

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
    tabs: defaultTabs,
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
    tabs: defaultTabs,
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
    tabs: defaultTabs,
    tabContent: { notes: '', quotes: '', questions: '' },
    createdAt: new Date('2024-01-05').toISOString(),
  },
];

const DEMO_COLLECTIONS = [
  { id: 'demo-collection-1', name: 'Deep Learning Foundations' },
  { id: 'demo-collection-2', name: 'NLP Papers' },
];

export function useReadingList() {
  const { user, isDemo } = useAuth();
  const [papers, setPapers] = useState([]);
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to save demo data
  const saveDemoPapers = useCallback((newPapers) => {
    setPapers(newPapers);
    sessionStorage.setItem('demo-papers', JSON.stringify(newPapers));
  }, []);

  const saveDemoCollections = useCallback((newCollections) => {
    setCollections(newCollections);
    sessionStorage.setItem('demo-collections', JSON.stringify(newCollections));
  }, []);

  // Subscribe to papers
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Demo mode: use local state
    if (isDemo) {
      const savedPapers = sessionStorage.getItem('demo-papers');
      const savedCollections = sessionStorage.getItem('demo-collections');

      if (savedPapers) {
        setPapers(JSON.parse(savedPapers));
      } else {
        setPapers(DEMO_PAPERS);
        sessionStorage.setItem('demo-papers', JSON.stringify(DEMO_PAPERS));
      }

      if (savedCollections) {
        setCollections(JSON.parse(savedCollections));
      } else {
        setCollections(DEMO_COLLECTIONS);
        sessionStorage.setItem('demo-collections', JSON.stringify(DEMO_COLLECTIONS));
      }

      setIsLoading(false);
      return;
    }

    const papersRef = collection(db, 'users', user.uid, 'papers');
    const q = query(papersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const papersList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPapers(papersList);
      setIsLoading(false);
    }, (error) => {
      console.error('Error subscribing to papers:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, isDemo]);

  // Subscribe to collections
  useEffect(() => {
    if (!user || isDemo) return;

    const collectionsRef = collection(db, 'users', user.uid, 'paperCollections');
    const q = query(collectionsRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const collectionsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCollections(collectionsList);
    }, (error) => {
      console.error('Error subscribing to collections:', error);
    });

    return () => unsubscribe();
  }, [user, isDemo]);

  // Add paper with new data model
  const addPaper = useCallback(async (paperData) => {
    if (!user) return null;

    // Demo mode: local state
    if (isDemo) {
      const newId = `demo-paper-${Date.now()}`;
      const newPaper = {
        id: newId,
        title: paperData.title || 'Untitled',
        authors: paperData.authors || '',
        year: paperData.year || null,
        url: paperData.url || '',
        doi: paperData.doi || '',
        journal: paperData.journal || '',
        publisher: paperData.publisher || '',
        volume: paperData.volume || '',
        issue: paperData.issue || '',
        pages: paperData.pages || '',
        status: paperData.status || 'to-read',
        priority: paperData.priority || null,
        starred: paperData.starred || false,
        collections: paperData.collections || [],
        summary: paperData.summary || '',
        tabs: defaultTabs,
        tabContent: { notes: '', quotes: '', questions: '' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveDemoPapers([newPaper, ...papers]);
      return newId;
    }

    try {
      const papersRef = collection(db, 'users', user.uid, 'papers');
      const docRef = await addDoc(papersRef, {
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
        status: paperData.status || 'to-read',
        priority: paperData.priority || null,
        starred: paperData.starred || false,
        collections: paperData.collections || [],
        summary: paperData.summary || '',
        // Attached file (if provided)
        ...(paperData.file && { file: paperData.file }),
        tabs: defaultTabs,
        tabContent: { notes: '', quotes: '', questions: '' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding paper:', error);
      return null;
    }
  }, [user, isDemo, papers, saveDemoPapers]);

  // Update paper
  const updatePaper = useCallback(async (paperId, updates) => {
    if (!user) return;

    // Demo mode: local state
    if (isDemo) {
      const newPapers = papers.map(p =>
        p.id === paperId
          ? { ...p, ...updates, updatedAt: new Date().toISOString() }
          : p
      );
      saveDemoPapers(newPapers);
      return;
    }

    try {
      const paperRef = doc(db, 'users', user.uid, 'papers', paperId);
      await updateDoc(paperRef, {
        ...updates,
        updatedAt: serverTimestamp(),
        // Set readAt when status changes to 'read'
        ...(updates.status === 'read' ? { readAt: serverTimestamp() } : {}),
      });
    } catch (error) {
      console.error('Error updating paper:', error);
    }
  }, [user, isDemo, papers, saveDemoPapers]);

  // Delete paper (and associated file if exists)
  const deletePaper = useCallback(async (paperId) => {
    if (!user) return;

    // Demo mode: local state
    if (isDemo) {
      saveDemoPapers(papers.filter(p => p.id !== paperId));
      return;
    }

    try {
      const paperRef = doc(db, 'users', user.uid, 'papers', paperId);

      // Get the paper to check for attached file
      const paperSnap = await getDoc(paperRef);
      if (paperSnap.exists()) {
        const paperData = paperSnap.data();

        // Delete the file from storage if it exists
        if (paperData.file?.path) {
          try {
            const fileRef = ref(storage, paperData.file.path);
            await deleteObject(fileRef);
          } catch (fileError) {
            // File might not exist, continue with paper deletion
            console.warn('Could not delete file:', fileError);
          }
        }
      }

      await deleteDoc(paperRef);
    } catch (error) {
      console.error('Error deleting paper:', error);
    }
  }, [user, isDemo, papers, saveDemoPapers]);

  // Add collection
  const addCollection = useCallback(async (name) => {
    if (!user) return null;

    // Check if collection already exists
    const existingCollection = collections.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existingCollection) return existingCollection.id;

    // Demo mode: local state
    if (isDemo) {
      const newId = `demo-collection-${Date.now()}`;
      saveDemoCollections([...collections, { id: newId, name }]);
      return newId;
    }

    try {
      const collectionsRef = collection(db, 'users', user.uid, 'paperCollections');
      const docRef = await addDoc(collectionsRef, {
        name,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding collection:', error);
      return null;
    }
  }, [user, isDemo, collections, saveDemoCollections]);

  // Update collection
  const updateCollection = useCallback(async (collectionId, updates) => {
    if (!user) return;

    // Demo mode: local state
    if (isDemo) {
      const newCollections = collections.map(c =>
        c.id === collectionId ? { ...c, ...updates } : c
      );
      saveDemoCollections(newCollections);
      return;
    }

    try {
      const collectionRef = doc(db, 'users', user.uid, 'paperCollections', collectionId);
      await updateDoc(collectionRef, updates);
    } catch (error) {
      console.error('Error updating collection:', error);
    }
  }, [user, isDemo, collections, saveDemoCollections]);

  // Delete collection
  const deleteCollection = useCallback(async (collectionId) => {
    if (!user) return;

    // Demo mode: local state
    if (isDemo) {
      saveDemoCollections(collections.filter(c => c.id !== collectionId));
      // Remove collection from all papers
      const updatedPapers = papers.map(p => ({
        ...p,
        collections: (p.collections || []).filter(c => c !== collectionId)
      }));
      saveDemoPapers(updatedPapers);
      return;
    }

    try {
      const collectionRef = doc(db, 'users', user.uid, 'paperCollections', collectionId);
      await deleteDoc(collectionRef);

      // Remove collection from all papers that have it
      for (const paper of papers) {
        if (paper.collections?.includes(collectionId)) {
          await updatePaper(paper.id, {
            collections: paper.collections.filter(c => c !== collectionId)
          });
        }
      }
    } catch (error) {
      console.error('Error deleting collection:', error);
    }
  }, [user, isDemo, papers, collections, saveDemoPapers, saveDemoCollections, updatePaper]);

  // Tab management
  const addTab = useCallback(async (paperId, tabName = 'New Tab') => {
    if (!user) return null;

    const paper = papers.find(p => p.id === paperId);
    if (!paper) return null;

    const newTabId = `tab-${Date.now()}`;
    const newTab = { id: newTabId, name: tabName };

    try {
      await updatePaper(paperId, {
        tabs: [...(paper.tabs || []), newTab],
        tabContent: { ...(paper.tabContent || {}), [newTabId]: '' }
      });
      return newTabId;
    } catch (error) {
      console.error('Error adding tab:', error);
      return null;
    }
  }, [user, papers, updatePaper]);

  const renameTab = useCallback(async (paperId, tabId, newName) => {
    if (!user) return;

    const paper = papers.find(p => p.id === paperId);
    if (!paper) return;

    const updatedTabs = (paper.tabs || []).map(tab =>
      tab.id === tabId ? { ...tab, name: newName } : tab
    );

    await updatePaper(paperId, { tabs: updatedTabs });
  }, [user, papers, updatePaper]);

  const deleteTab = useCallback(async (paperId, tabId) => {
    if (!user) return;

    const paper = papers.find(p => p.id === paperId);
    if (!paper || (paper.tabs || []).length <= 1) return;

    const updatedTabs = (paper.tabs || []).filter(tab => tab.id !== tabId);
    const updatedContent = { ...(paper.tabContent || {}) };
    delete updatedContent[tabId];

    await updatePaper(paperId, {
      tabs: updatedTabs,
      tabContent: updatedContent
    });
  }, [user, papers, updatePaper]);

  const updateTabContent = useCallback(async (paperId, tabId, content) => {
    if (!user) return;

    const paper = papers.find(p => p.id === paperId);
    if (!paper) return;

    await updatePaper(paperId, {
      tabContent: { ...(paper.tabContent || {}), [tabId]: content }
    });
  }, [user, papers, updatePaper]);

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
      'to-read': papers.filter(p => p.status === 'to-read').length,
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
    collections,
    isLoading,
    addPaper,
    updatePaper,
    deletePaper,
    addCollection,
    updateCollection,
    deleteCollection,
    addTab,
    renameTab,
    deleteTab,
    updateTabContent,
    getPapersByStatus,
    getPapersByCollection,
    getCounts,
    getStarredPapers,
  };
}
