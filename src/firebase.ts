import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query,
  where,
  limit as firestoreLimit,
  orderBy,
  startAfter,
  getDocs,
  getDoc,
  getCountFromServer,
  increment,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, browserLocalPersistence, setPersistence, onAuthStateChanged, signOut } from 'firebase/auth';
import { Manga, Chapter, User, VipRequest, Employee, MovieItem, MovieEpisode } from './types';
import { INITIAL_MANGAS, INITIAL_CHAPTERS, INITIAL_USERS, DEFAULT_GENRES, INITIAL_EMPLOYEES, INITIAL_MOVIES, INITIAL_MOVIE_EPISODES } from './data';

const DEFAULT_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';
import { compressDataUrl, uploadDataUrlToCloud } from './utils/imageUpload';

import firebaseConfigJson from '../firebase-applet-config.json';

const DEFAULT_FIREBASE_CONFIG = {
  projectId: "braided-theory-j5fd2",
  appId: "1:937153025853:web:8171fde6bf4be51a255754",
  apiKey: "AIzaSyBLvcSArHSCHwQ24PM8V4jm6ABerBjlxQo",
  authDomain: "braided-theory-j5fd2.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-misora-025cd636-903c-4204-8074-6611dbeedb30",
  storageBucket: "braided-theory-j5fd2.firebasestorage.app",
  messagingSenderId: "937153025853",
};

// 1. Firebase configuration detection
const env = (import.meta as any).env || {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || (firebaseConfigJson as any).apiKey || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || (firebaseConfigJson as any).authDomain || DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || (firebaseConfigJson as any).projectId || DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || (firebaseConfigJson as any).storageBucket || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || (firebaseConfigJson as any).messagingSenderId || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || (firebaseConfigJson as any).appId || DEFAULT_FIREBASE_CONFIG.appId,
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || (firebaseConfigJson as any).firestoreDatabaseId || DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId || '(default)'
};

let app: any;
let db: any = null;
let auth: any = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const dbId = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') 
    ? firebaseConfig.firestoreDatabaseId 
    : undefined;

  // 1. Firestore Persistence (IndexedDB caching enabled)
  try {
    const cacheSettings = {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    };
    db = dbId 
      ? initializeFirestore(app, cacheSettings, dbId)
      : initializeFirestore(app, cacheSettings);
  } catch (persistentErr) {
    try {
      db = dbId 
        ? initializeFirestore(app, { localCache: memoryLocalCache() }, dbId)
        : initializeFirestore(app, { localCache: memoryLocalCache() });
    } catch {
      db = dbId ? getFirestore(app, dbId) : getFirestore(app);
    }
  }
  auth = getAuth(app);
  try {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  } catch (e) {}
} catch (error) {
  console.error("Failed to initialize Firebase app:", error);
  db = null;
  auth = null;
}

export { db, auth };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isExpectedNotice = errMessage.toLowerCase().includes('quota') || 
                           errMessage.toLowerCase().includes('resource-exhausted') || 
                           errMessage.toLowerCase().includes('limit exceeded') ||
                           errMessage.toLowerCase().includes('unavailable') ||
                           errMessage.toLowerCase().includes('could not reach cloud firestore') ||
                           errMessage.toLowerCase().includes('connection failed') ||
                           errMessage.toLowerCase().includes('offline');

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isExpectedNotice) {
    console.warn(`[Firestore Connection/Cache Notice] ${operationType} on ${path}: serving smoothly from cached storage. Details: ${errMessage}`);
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  return errInfo;
}

export async function loginWithGooglePopup(): Promise<{ email: string; displayName: string } | null> {
  if (!auth) {
    throw new Error('Firebase Auth холбогдоогүй байна.');
  }
  const provider = new GoogleAuthProvider();
  // Ensure the native account chooser is shown with accounts signed in on this device
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  if (result && result.user) {
    return {
      email: result.user.email || '',
      displayName: result.user.displayName || result.user.email?.split('@')[0] || 'Google User'
    };
  }
  return null;
}

export function subscribeToAuth(callback: (user: { email: string; displayName: string } | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser && firebaseUser.email) {
      callback({
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'Google User'
      });
    } else {
      callback(null);
    }
  });
}

export async function logoutFromFirebase(): Promise<void> {
  if (auth) {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Sign out notice:", e);
    }
  }
}

// 2. Real-time Event Bus for Local Fallback
const listeners: { [key: string]: Function[] } = {
  mangas: [],
  chapters: [],
  users: [],
  vipRequests: [],
  genres: [],
  siteConfig: [],
  movies: [],
  movieEpisodes: []
};

let cachedMangas: Manga[] | null = null;
let cachedChapters: Chapter[] | null = null;

export function getStoredMangas(): Manga[] {
  if (cachedMangas !== null && cachedMangas.length > 0) {
    return cachedMangas;
  }
  const deletedIds = getDeletedIds('mangas');
  if (typeof window !== 'undefined' && window.__INITIAL_DATA__?.mangas && window.__INITIAL_DATA__.mangas.length > 0) {
    cachedMangas = window.__INITIAL_DATA__.mangas.filter(m => m && !deletedIds.has(String(m.id || '').trim().toLowerCase()) && !String(m.id || '').startsWith('manga-') && m.title !== 'ёсч');
    return cachedMangas;
  }
  try {
    const saved = localStorage.getItem('ayako_mangas');
    if (saved !== null && saved !== undefined) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filter out old demo manga mock ids or test strings if any
        cachedMangas = parsed.filter(m => m && !deletedIds.has(String(m.id || '').trim().toLowerCase()) && !String(m.id || '').startsWith('manga-') && m.title !== 'ёсч');
        return cachedMangas;
      }
    }
  } catch (e) {}

  cachedMangas = [];
  return cachedMangas;
}

export function getStoredChapters(): Chapter[] {
  if (cachedChapters !== null && cachedChapters.length > 0) {
    return cachedChapters;
  }
  const deletedIds = getDeletedIds('chapters');
  const deletedMangaIds = getDeletedIds('mangas');
  if (typeof window !== 'undefined' && window.__INITIAL_DATA__?.chapters && window.__INITIAL_DATA__.chapters.length > 0) {
    cachedChapters = window.__INITIAL_DATA__.chapters.filter(c => {
      if (!c) return false;
      const cId = String(c.id || '').trim().toLowerCase();
      const cMangaId = String(c.mangaId || '').trim().toLowerCase();
      return !deletedIds.has(cId) && !deletedMangaIds.has(cMangaId) && !cId.startsWith('ch-');
    });
    return cachedChapters;
  }
  try {
    const saved = localStorage.getItem('ayako_chapters');
    if (saved !== null && saved !== undefined) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedChapters = parsed.filter(c => {
          if (!c) return false;
          const cId = String(c.id || '').trim().toLowerCase();
          const cMangaId = String(c.mangaId || '').trim().toLowerCase();
          return !deletedIds.has(cId) && !deletedMangaIds.has(cMangaId) && !cId.startsWith('ch-');
        });
        return cachedChapters;
      }
    }
  } catch (e) {}

  cachedChapters = [];
  return cachedChapters;
}

export function triggerLocalUpdate(key: string, data: any) {
  if (!key) return;
  if (key === 'mangas' && Array.isArray(data)) {
    cachedMangas = data;
  }
  if (key === 'chapters' && Array.isArray(data)) {
    cachedChapters = data;
  }
  try {
    localStorage.setItem(`ayako_${key}`, JSON.stringify(data));
  } catch (err) {
    console.warn(`[Storage Warning] Could not save ayako_${key} to localStorage:`, err);
  }

  // Synchronize state with backend server cache instantly
  try {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      let syncData = data;
      if (key === 'chapters' && Array.isArray(data)) {
        // Strip out heavy page image arrays for fast server synchronization
        syncData = data.map((c: any) => ({
          id: c.id,
          mangaId: c.mangaId,
          title: c.title,
          chapterNumber: c.chapterNumber,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          isVipOnly: c.isVipOnly,
          likes: c.likes,
          views: c.views
        }));
      }
      fetch('/api/sync-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, data: syncData }),
        keepalive: true
      }).catch(() => {});
    }
  } catch (e) {}

  if (listeners[key]) {
    const payload = key === 'siteConfig' ? (Array.isArray(data) ? (data[0] || {}) : data) : data;
    listeners[key].forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.warn(`Error executing listener for ${key}:`, err);
      }
    });
  }
}

// Listen to other windows/tabs updates locally via storage event
if (typeof window !== 'undefined') {
  ['mangas', 'chapters', 'users', 'vipRequests', 'genres', 'siteConfig', 'movies', 'movieEpisodes'].forEach(key => {
    window.addEventListener('storage', (e) => {
      if (e.key === `ayako_${key}` && e.newValue && listeners[key]) {
        try {
          const parsed = JSON.parse(e.newValue);
          const payload = key === 'siteConfig' ? (Array.isArray(parsed) ? (parsed[0] || {}) : parsed) : parsed;
          listeners[key].forEach(cb => {
            try {
              cb(payload);
            } catch (err) {
              console.warn(`Error in storage listener for ${key}:`, err);
            }
          });
        } catch (err) {
          console.error(err);
        }
      }
    });
  });
}

function getLocalData<T>(key: string, initial: T[]): T[] {
  try {
    const saved = localStorage.getItem(`ayako_${key}`);
    if (saved !== null && saved !== undefined) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed as T[];
      }
    }
  } catch (err) {
    console.warn(`[Storage Warning] Error reading ayako_${key} from localStorage:`, err);
  }
  return initial;
}

export function parseTimestamp(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const t = new Date(val).getTime();
    return isNaN(t) ? 0 : t;
  }
  if (val && typeof val === 'object') {
    if ('seconds' in val && typeof val.seconds === 'number') {
      return val.seconds * 1000;
    }
    if ('_seconds' in val && typeof val._seconds === 'number') {
      return val._seconds * 1000;
    }
    if (val instanceof Date) {
      return val.getTime();
    }
  }
  return 0;
}

// Real-time Deleted IDs Registry in Memory + LocalStorage Persistence
function getStoredDeletedSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(`ayako_deleted_${key}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map(i => String(i).trim().toLowerCase()));
      }
    }
  } catch {}
  return new Set<string>();
}

function saveStoredDeletedSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(`ayako_deleted_${key}`, JSON.stringify(Array.from(set)));
  } catch {}
}

const inMemoryDeletedMangaIds = getStoredDeletedSet('mangas');
const inMemoryDeletedChapterIds = getStoredDeletedSet('chapters');
const inMemoryDeletedMovieIds = getStoredDeletedSet('movies');
const inMemoryDeletedEpisodeIds = getStoredDeletedSet('movieEpisodes');

export function getDeletedIds(key: 'mangas' | 'chapters' | 'movies' | 'movieEpisodes'): Set<string> {
  if (key === 'mangas') return inMemoryDeletedMangaIds;
  if (key === 'chapters') return inMemoryDeletedChapterIds;
  if (key === 'movies') return inMemoryDeletedMovieIds;
  return inMemoryDeletedEpisodeIds;
}

export function addDeletedId(key: 'mangas' | 'chapters' | 'movies' | 'movieEpisodes', id: string): void {
  const targetId = String(id || '').trim().toLowerCase();
  if (!targetId) return;

  if (key === 'mangas') {
    inMemoryDeletedMangaIds.add(targetId);
    saveStoredDeletedSet('mangas', inMemoryDeletedMangaIds);
  } else if (key === 'chapters') {
    inMemoryDeletedChapterIds.add(targetId);
    saveStoredDeletedSet('chapters', inMemoryDeletedChapterIds);
  } else if (key === 'movies') {
    inMemoryDeletedMovieIds.add(targetId);
    saveStoredDeletedSet('movies', inMemoryDeletedMovieIds);
  } else {
    inMemoryDeletedEpisodeIds.add(targetId);
    saveStoredDeletedSet('movieEpisodes', inMemoryDeletedEpisodeIds);
  }
}

export function removeDeletedId(key: 'mangas' | 'chapters' | 'movies' | 'movieEpisodes', id: string): void {
  const targetId = String(id || '').trim().toLowerCase();
  if (!targetId) return;

  if (key === 'mangas') {
    inMemoryDeletedMangaIds.delete(targetId);
    saveStoredDeletedSet('mangas', inMemoryDeletedMangaIds);
  } else if (key === 'chapters') {
    inMemoryDeletedChapterIds.delete(targetId);
    saveStoredDeletedSet('chapters', inMemoryDeletedChapterIds);
  } else if (key === 'movies') {
    inMemoryDeletedMovieIds.delete(targetId);
    saveStoredDeletedSet('movies', inMemoryDeletedMovieIds);
  } else {
    inMemoryDeletedEpisodeIds.delete(targetId);
    saveStoredDeletedSet('movieEpisodes', inMemoryDeletedEpisodeIds);
  }
}

// 3. Real-time Subscriptions (onSnapshot listeners across all devices)
export function subscribeToMangas(callback: (mangas: Manga[]) => void): () => void {
  if (!listeners.mangas.includes(callback)) {
    listeners.mangas.push(callback);
  }
  const cleanupLocal = () => {
    listeners.mangas = listeners.mangas.filter(cb => cb !== callback);
  };

  const storedMangas = getStoredMangas();
  callback(storedMangas);

  if (!db) {
    return cleanupLocal;
  }

  let firestoreUnsub: (() => void) | null = null;
  try {
    const colRef = collection(db, 'mangas');
    firestoreUnsub = onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) {
        triggerLocalUpdate('mangas', []);
        return;
      }

      const remoteMangas: Manga[] = [];
      snapshot.forEach((docSnap) => {
        const docId = docSnap.id;
        const data = docSnap.data();
        if (!data) return;
        const cover = data.coverUrl || data.coverImage || '';
        remoteMangas.push({
          ...data,
          id: docId,
          title: data.title || 'Нэргүй манга',
          author: data.author || '',
          description: data.description || '',
          coverUrl: cover,
          status: data.status || 'publishing',
          genres: Array.isArray(data.genres) ? data.genres : [],
          type: data.type || 'manga',
          likes: typeof data.likes === 'number' ? data.likes : 0,
          views: typeof data.views === 'number' ? data.views : 0,
          rating: typeof data.rating === 'number' ? data.rating : 5.0,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || data.createdAt || new Date().toISOString()
        } as Manga);
      });

      remoteMangas.sort((a, b) => {
        const timeA = Math.max(parseTimestamp(a.updatedAt), parseTimestamp(a.createdAt));
        const timeB = Math.max(parseTimestamp(b.updatedAt), parseTimestamp(b.createdAt));
        if (timeA !== timeB) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });

      triggerLocalUpdate('mangas', remoteMangas);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'mangas');
    });
  } catch (err) {
    console.warn("Mangas init error:", err);
  }
  return () => {
    if (firestoreUnsub) firestoreUnsub();
    cleanupLocal();
  };
}

export function chunkChapterImages(images: string[], maxChunkLength = 650000): string[][] {
  if (!images || images.length === 0) return [[]];
  const chunks: string[][] = [];
  let currentChunk: string[] = [];

  for (const img of images) {
    if (!img) continue;
    const testChunk = [...currentChunk, img];
    if (JSON.stringify(testChunk).length > maxChunkLength && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [img];
    } else {
      currentChunk.push(img);
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [[]];
}

async function cleanupChapterParts(chapterId: string, fromPartIndex = 2, maxCheck = 20): Promise<void> {
  if (!db) return;
  for (let i = fromPartIndex; i <= maxCheck; i++) {
    const partId = `${chapterId}_part${i}`;
    deleteDoc(doc(db, 'chapters', partId)).catch(() => {});
  }
}

export function subscribeToChapters(callback: (chapters: Chapter[]) => void): () => void {
  if (!listeners.chapters.includes(callback)) {
    listeners.chapters.push(callback);
  }
  const cleanupLocal = () => {
    listeners.chapters = listeners.chapters.filter(cb => cb !== callback);
  };

  const storedChapters = getStoredChapters();
  callback(storedChapters);

  if (!db) {
    return cleanupLocal;
  }

  let firestoreUnsub: (() => void) | null = null;
  try {
    const colRef = collection(db, 'chapters');
    firestoreUnsub = onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) {
        triggerLocalUpdate('chapters', []);
        return;
      }

      const rawDocs: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data) {
          rawDocs.push({ docId: docSnap.id, ...data });
        }
      });

      const partMap = new Map<string, Array<{ partIndex: number; images: string[] }>>();
      const mainChapters: Chapter[] = [];

      for (const data of rawDocs) {
        const docId = String(data.docId || '').trim();
        if (data.isPartDoc && data.parentChapterId) {
          const parentIdLower = String(data.parentChapterId).trim().toLowerCase();
          if (!partMap.has(parentIdLower)) {
            partMap.set(parentIdLower, []);
          }
          partMap.get(parentIdLower)!.push({
            partIndex: Number(data.partIndex) || 2,
            images: Array.isArray(data.images) ? data.images : []
          });
        } else {
          mainChapters.push({
            ...data,
            id: docId,
            mangaId: data.mangaId || '',
            title: data.title || '',
            chapterNumber: typeof data.chapterNumber === 'number' ? data.chapterNumber : 1,
            images: Array.isArray(data.images) ? data.images : Array.isArray((data as any).pages) ? (data as any).pages : [],
            createdAt: data.createdAt || new Date().toISOString(),
            isVipOnly: !!data.isVipOnly
          } as Chapter);
        }
      }

      const assembledChapters: Chapter[] = mainChapters.map(ch => {
        const chIdLower = String(ch.id || '').trim().toLowerCase();
        const parts = partMap.get(chIdLower);
        let finalImages = ch.images || [];
        if (parts && parts.length > 0) {
          parts.sort((a, b) => a.partIndex - b.partIndex);
          const extraImages = parts.flatMap(p => p.images || []);
          finalImages = [...finalImages, ...extraImages];
        }
        return {
          ...ch,
          images: Array.isArray(finalImages) ? finalImages.filter(Boolean) : []
        };
      });

      assembledChapters.sort((a, b) => {
        const timeA = parseTimestamp(a.createdAt);
        const timeB = parseTimestamp(b.createdAt);
        if (timeA !== timeB) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });

      triggerLocalUpdate('chapters', assembledChapters);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'chapters');
    });
  } catch (err) {
    console.warn("Chapters init error:", err);
  }
  return () => {
    if (firestoreUnsub) firestoreUnsub();
    cleanupLocal();
  };
}

export function subscribeToUsers(callback: (users: User[]) => void): () => void {
  if (!listeners.users.includes(callback)) {
    listeners.users.push(callback);
  }
  const cleanupLocal = () => {
    listeners.users = listeners.users.filter(cb => cb !== callback);
  };

  const initial = getLocalData<User>('users', []).filter(
    u => u && u.id !== '11112222' && u.id !== '77777777'
  );
  callback(initial);

  if (!db) {
    return cleanupLocal;
  }

  let firestoreUnsub: (() => void) | null = null;
  try {
    const colRef = collection(db, 'users');
    firestoreUnsub = onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) {
        triggerLocalUpdate('users', []);
        return;
      }
      const list: User[] = [];
      snapshot.forEach((docSnap) => {
        const u = { ...docSnap.data(), id: docSnap.id } as User;
        if (u.id === '11112222' || u.id === '77777777') {
          deleteDoc(doc(db, 'users', u.id)).catch(() => {});
        } else {
          list.push(u);
        }
      });
      triggerLocalUpdate('users', list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
  } catch (err) {
    console.warn("Users init error:", err);
  }
  return () => {
    if (firestoreUnsub) firestoreUnsub();
    cleanupLocal();
  };
}

export function subscribeToVipRequests(callback: (requests: VipRequest[]) => void): () => void {
  if (!listeners.vipRequests.includes(callback)) {
    listeners.vipRequests.push(callback);
  }
  const cleanupLocal = () => {
    listeners.vipRequests = listeners.vipRequests.filter(cb => cb !== callback);
  };

  callback(getLocalData<VipRequest>('vipRequests', []));

  if (!db) {
    return cleanupLocal;
  }

  let firestoreUnsub: (() => void) | null = null;
  try {
    const colRef = collection(db, 'vipRequests');
    firestoreUnsub = onSnapshot(colRef, (snapshot) => {
      const list: VipRequest[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as VipRequest);
      });
      triggerLocalUpdate('vipRequests', list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'vipRequests');
      callback(getLocalData<VipRequest>('vipRequests', []));
    });
  } catch (err) {
    console.warn("VipRequests init error:", err);
  }
  return () => {
    if (firestoreUnsub) firestoreUnsub();
    cleanupLocal();
  };
}

export interface BankConfig {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  instructions: string;
}

export function subscribeToSiteConfig(callback: (config: { siteName?: string; bannerTitle?: string; bannerSubtitle?: string; salaryConfig?: any; vipPlans?: any[]; bankConfig?: BankConfig; homeBannerUrl?: string; homeBannerAudioUrl?: string; homeBannerMediaType?: string; themeColor?: string; isFreeSiteMode?: boolean; isMoviesTabEnabled?: boolean; employees?: Employee[] }) => void): () => void {
  if (!listeners.siteConfig.includes(callback)) {
    listeners.siteConfig.push(callback);
  }
  const cleanupLocal = () => {
    listeners.siteConfig = listeners.siteConfig.filter(cb => cb !== callback);
  };

  const initialConfig = typeof window !== 'undefined' ? window.__INITIAL_DATA__?.siteConfig : null;
  const localArr = getLocalData<any>('siteConfig', [{}]);
  const cachedData = Array.isArray(localArr) ? (localArr[0] || {}) : (localArr || {});
  const initialData = initialConfig ? { ...cachedData, ...initialConfig } : cachedData;
  callback(initialData);

  if (!db) {
    return cleanupLocal;
  }

  let firestoreUnsub: (() => void) | null = null;
  try {
    const docRef = doc(db, 'settings', 'siteConfig');
    firestoreUnsub = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let updated = false;
        if (!data.themeColor) {
          data.themeColor = '#ff2a85';
          updated = true;
        }
        if (!data.siteName || data.siteName === 'AYAKO MANGA' || data.siteName === 'АЯАКО') {
          data.siteName = 'MISORA';
          updated = true;
        }
        if (data.isMoviesTabEnabled === undefined) {
          data.isMoviesTabEnabled = true;
          updated = true;
        }
        if (updated) {
          setDoc(docRef, { themeColor: data.themeColor, siteName: data.siteName, isMoviesTabEnabled: data.isMoviesTabEnabled }, { merge: true }).catch(() => {});
        }
        triggerLocalUpdate('siteConfig', data);
      } else {
        const defaultConfig = {
          siteName: 'MISORA',
          bannerTitle: 'MANGA',
          bannerSubtitle: 'Манга, Махвуа, Комиксыг хамгийн хурднаар орчуулан хүргэж байна',
          isFreeSiteMode: false,
          isMoviesTabEnabled: true,
          themeColor: '#ff2a85',
          vipPlans: [
            { id: 'vp1', title: '1 САР VIP', durationText: '1 сар', price: '10,000₮', popular: true },
            { id: 'vp2', title: '3 САР VIP', durationText: '3 сар', price: '25,000₮', popular: false },
            { id: 'vp3', title: '12 САР VIP', durationText: '12 сар', price: '80,000₮', popular: false }
          ],
          bankConfig: {
            bankName: 'Хаан Банк',
            accountNumber: '5000123456',
            accountHolder: 'Аяко Манга ХХК',
            instructions: 'Гүйцэтгэх утга дээр өөрийн бүртгэлтэй Имэйл эсвэл Утасны дугаарыг бичнэ үү.'
          },
          salaryConfig: {
            translatorRate: 1500,
            editorRate: 1000,
            typesetterRate: 800
          },
          employees: INITIAL_EMPLOYEES
        };
        try {
          await setDoc(docRef, defaultConfig);
        } catch (e) {
          console.warn("Failed to seed siteConfig in Firestore:", e);
        }
        triggerLocalUpdate('siteConfig', defaultConfig);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/siteConfig');
      const localArr = getLocalData<any>('siteConfig', [{}]);
      const initialData = Array.isArray(localArr) ? (localArr[0] || {}) : (localArr || {});
      callback({ isMoviesTabEnabled: true, ...initialData });
    });
  } catch (err) {
    console.warn("SiteConfig init notice:", err);
  }
  return () => {
    if (firestoreUnsub) firestoreUnsub();
    cleanupLocal();
  };
}

export async function forceSyncWithFirestoreServer(): Promise<boolean> {
  if (!db) return false;
  try {
    // 1. Fetch Mangas
    try {
      const mangasCol = collection(db, 'mangas');
      const mangasSnap = await getDocs(mangasCol);
      if (mangasSnap && !mangasSnap.empty) {
        const freshMangas: Manga[] = [];
        mangasSnap.forEach((docSnap: any) => {
          const data = docSnap.data();
          const docId = docSnap.id;
          const cover = data.coverUrl || data.coverImage || '';
          remoteMangasPush(freshMangas, data, docId, cover);
        });
        if (freshMangas.length > 0) {
          freshMangas.sort((a, b) => {
            const timeA = Math.max(parseTimestamp(a.updatedAt), parseTimestamp(a.createdAt));
            const timeB = Math.max(parseTimestamp(b.updatedAt), parseTimestamp(b.createdAt));
            if (timeA !== timeB) return timeB - timeA;
            return b.id.localeCompare(a.id);
          });
          triggerLocalUpdate('mangas', freshMangas);
        }
      }
    } catch (err) {
      console.warn("Mangas sync notice:", err);
    }

    // 2. Fetch Chapters
    try {
      const chaptersCol = collection(db, 'chapters');
      const chaptersSnap = await getDocs(chaptersCol);
      if (chaptersSnap && !chaptersSnap.empty) {
        const rawDocs: any[] = [];
        chaptersSnap.forEach((docSnap: any) => {
          const data = docSnap.data();
          rawDocs.push({ docId: docSnap.id, ...data });
        });

        const partMap = new Map<string, Array<{ partIndex: number; images: string[] }>>();
        const mainChapters: Chapter[] = [];

        for (const data of rawDocs) {
          const docId = String(data.docId || '').trim();
          if (data.isPartDoc && data.parentChapterId) {
            const parentIdLower = String(data.parentChapterId).trim().toLowerCase();
            if (!partMap.has(parentIdLower)) {
              partMap.set(parentIdLower, []);
            }
            partMap.get(parentIdLower)!.push({
              partIndex: Number(data.partIndex) || 2,
              images: Array.isArray(data.images) ? data.images : []
            });
          } else {
            mainChapters.push({ ...data, id: docId } as Chapter);
          }
        }

        const assembledChapters: Chapter[] = mainChapters.map(ch => {
          const chIdLower = String(ch.id || '').trim().toLowerCase();
          const parts = partMap.get(chIdLower);
          if (parts && parts.length > 0) {
            parts.sort((a, b) => a.partIndex - b.partIndex);
            const extraImages = parts.flatMap(p => p.images);
            return {
              ...ch,
              images: [...(ch.images || []), ...extraImages]
            };
          }
          return ch;
        });

        if (assembledChapters.length > 0) {
          assembledChapters.sort((a, b) => {
            const timeA = parseTimestamp(a.createdAt);
            const timeB = parseTimestamp(b.createdAt);
            if (timeA !== timeB) return timeB - timeA;
            return b.id.localeCompare(a.id);
          });
          triggerLocalUpdate('chapters', assembledChapters);
        }
      }
    } catch (err) {
      console.warn("Chapters sync notice:", err);
    }

    // 3. Fetch Users
    try {
      const usersCol = collection(db, 'users');
      const usersSnap = await getDocs(usersCol);
      if (usersSnap && !usersSnap.empty) {
        const freshUsers: User[] = [];
        usersSnap.forEach((docSnap: any) => {
          const u = { ...docSnap.data(), id: docSnap.id } as User;
          if (u.id !== '11112222' && u.id !== '77777777') {
            freshUsers.push(u);
          }
        });
        if (freshUsers.length > 0) {
          triggerLocalUpdate('users', freshUsers);
        }
      }
    } catch (err) {
      console.warn("Users sync notice:", err);
    }

    // 4. Fetch Movies
    try {
      const moviesCol = collection(db, 'movies');
      const moviesSnap = await getDocs(moviesCol);
      if (moviesSnap && !moviesSnap.empty) {
        const freshMovies: MovieItem[] = [];
        moviesSnap.forEach((docSnap: any) => {
          const data = docSnap.data();
          const docId = docSnap.id;
          freshMovies.push({ ...data, id: docId } as MovieItem);
        });
        if (freshMovies.length > 0) {
          freshMovies.sort((a, b) => {
            const timeA = parseTimestamp(a.updatedAt || a.createdAt);
            const timeB = parseTimestamp(b.updatedAt || b.createdAt);
            return timeB - timeA;
          });
          triggerLocalUpdate('movies', freshMovies);
        }
      }
    } catch (err) {
      console.warn("Movies sync notice:", err);
    }

    // 5. Fetch Movie Episodes
    try {
      const episodesCol = collection(db, 'movieEpisodes');
      const episodesSnap = await getDocs(episodesCol);
      if (episodesSnap && !episodesSnap.empty) {
        const freshEpisodes: MovieEpisode[] = [];
        episodesSnap.forEach((docSnap: any) => {
          const data = docSnap.data();
          const docId = docSnap.id;
          freshEpisodes.push({ ...data, id: docId } as MovieEpisode);
        });
        if (freshEpisodes.length > 0) {
          freshEpisodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
          triggerLocalUpdate('movieEpisodes', freshEpisodes);
        } else {
          triggerLocalUpdate('movieEpisodes', []);
        }
      } else {
        triggerLocalUpdate('movieEpisodes', []);
      }
    } catch (err) {
      console.warn("MovieEpisodes sync notice:", err);
    }

    return true;
  } catch (err) {
    console.warn("forceSyncWithFirestoreServer notice:", err);
    return false;
  }
}

function remoteMangasPush(list: Manga[], data: any, docId: string, cover: string) {
  list.push({
    ...data,
    id: docId,
    title: data.title || 'Нэргүй манга',
    author: data.author || '',
    description: data.description || '',
    coverUrl: cover,
    status: data.status || 'publishing',
    genres: Array.isArray(data.genres) ? data.genres : [],
    type: data.type || 'manga',
    likes: typeof data.likes === 'number' ? data.likes : 0,
    views: typeof data.views === 'number' ? data.views : 0,
    rating: typeof data.rating === 'number' ? data.rating : 5.0,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || data.createdAt || new Date().toISOString()
  } as Manga);
}

export async function saveSiteConfigToDb(config: { siteName?: string; bannerTitle?: string; bannerSubtitle?: string; salaryConfig?: any; vipPlans?: any[]; bankConfig?: BankConfig; homeBannerUrl?: string; homeBannerAudioUrl?: string; homeBannerMediaType?: string; themeColor?: string; isFreeSiteMode?: boolean; isMoviesTabEnabled?: boolean; employees?: Employee[] }): Promise<void> {
  const currentArr = getLocalData<any>('siteConfig', [{}]);
  const current = Array.isArray(currentArr) ? (currentArr[0] || {}) : (currentArr || {});
  const merged = { ...current, ...config };

  if (merged.homeBannerUrl && merged.homeBannerUrl.startsWith('data:image/')) {
    try {
      const cloudUrl = await uploadDataUrlToCloud(merged.homeBannerUrl);
      if (cloudUrl && cloudUrl.startsWith('http')) {
        merged.homeBannerUrl = cloudUrl;
      }
    } catch (e) {
      console.warn("Banner image upload notice:", e);
    }
  }

  triggerLocalUpdate('siteConfig', merged);

  if (db) {
    try {
      const docRef = doc(db, 'settings', 'siteConfig');
      const safeConfig = { ...merged };
      // Omit local blob: or idb: references that only exist on a single device
      if (safeConfig.homeBannerUrl === 'idb:video' || safeConfig.homeBannerUrl?.startsWith('blob:')) {
        delete safeConfig.homeBannerUrl;
      }
      if (safeConfig.homeBannerAudioUrl === 'idb:audio' || safeConfig.homeBannerAudioUrl?.startsWith('blob:')) {
        delete safeConfig.homeBannerAudioUrl;
      }
      await setDoc(docRef, safeConfig, { merge: true });
    } catch (err) {
      console.warn('saveSiteConfigToDb warning:', err);
    }
  }
}

// 4. Writes & Deletions
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)) as any;
  }
  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      cleaned[key] = (typeof val === 'object' && val !== null) ? sanitizeForFirestore(val) : val;
    }
  }
  return cleaned as T;
}

export async function addMangaToDb(manga: Manga): Promise<void> {
  const targetId = String(manga.id || '').trim().toLowerCase();
  removeDeletedId('mangas', manga.id);
  let sanitizedCover = (manga.coverUrl || '').trim();
  if (sanitizedCover.includes('localhost:3000')) {
    sanitizedCover = sanitizedCover.replace(/http:\/\/localhost:3000/g, '');
  }
  if (sanitizedCover.startsWith('blob:') || sanitizedCover.startsWith('data:image/')) {
    try {
      const cloudUrl = await uploadDataUrlToCloud(sanitizedCover);
      if (cloudUrl && (cloudUrl.startsWith('http://') || cloudUrl.startsWith('https://'))) {
        sanitizedCover = cloudUrl;
      } else {
        sanitizedCover = await compressDataUrl(sanitizedCover, 1600, 0.88);
      }
    } catch {
      sanitizedCover = await compressDataUrl(sanitizedCover, 1400, 0.85);
    }
  }
  const nowIso = new Date().toISOString();
  const sanitizedManga = {
    ...manga,
    coverUrl: sanitizedCover,
    createdAt: manga.createdAt || nowIso,
    updatedAt: nowIso
  };

  const list = getStoredMangas();
  const updated = [sanitizedManga, ...list.filter(m => String(m.id || '').trim().toLowerCase() !== targetId)];
  triggerLocalUpdate('mangas', updated);

  if (db) {
    try {
      const docRef = doc(db, 'mangas', sanitizedManga.id);
      const dataToSave = sanitizeForFirestore({
        ...sanitizedManga,
        coverUrl: sanitizedManga.coverUrl,
        coverImage: sanitizedManga.coverUrl
      });
      await setDoc(docRef, dataToSave, { merge: true });
    } catch (err) {
      console.error("Firestore addManga error:", err);
      try {
        const fallbackCover = await compressDataUrl(sanitizedManga.coverUrl, 1600, 0.90);
        const safeData = sanitizeForFirestore({
          ...sanitizedManga,
          coverUrl: fallbackCover,
          coverImage: fallbackCover
        });
        await setDoc(doc(db, 'mangas', sanitizedManga.id), safeData, { merge: true });
      } catch (retryErr) {
        console.error("Firestore addManga retry error:", retryErr);
      }
    }
  }
}

export async function updateMangaInDb(manga: Manga): Promise<void> {
  const targetId = String(manga.id || '').trim().toLowerCase();
  removeDeletedId('mangas', manga.id);
  let sanitizedCover = (manga.coverUrl || '').trim();
  if (sanitizedCover.includes('localhost:3000')) {
    sanitizedCover = sanitizedCover.replace(/http:\/\/localhost:3000/g, '');
  }
  if (sanitizedCover.startsWith('blob:') || sanitizedCover.startsWith('data:image/')) {
    try {
      const cloudUrl = await uploadDataUrlToCloud(sanitizedCover);
      if (cloudUrl && (cloudUrl.startsWith('http://') || cloudUrl.startsWith('https://'))) {
        sanitizedCover = cloudUrl;
      } else {
        sanitizedCover = await compressDataUrl(sanitizedCover, 1600, 0.88);
      }
    } catch {
      sanitizedCover = await compressDataUrl(sanitizedCover, 1400, 0.85);
    }
  }
  const nowIso = new Date().toISOString();
  const sanitizedManga = {
    ...manga,
    coverUrl: sanitizedCover,
    createdAt: manga.createdAt || nowIso,
    updatedAt: manga.updatedAt || nowIso
  };

  const list = getStoredMangas();
  let found = false;
  const updated = list.map(m => {
    if (String(m.id || '').trim().toLowerCase() === targetId) {
      found = true;
      return sanitizedManga;
    }
    return m;
  });
  if (!found) {
    updated.unshift(sanitizedManga);
  }
  triggerLocalUpdate('mangas', updated);

  if (db) {
    try {
      const docRef = doc(db, 'mangas', sanitizedManga.id);
      const dataToUpdate = sanitizeForFirestore({
        ...sanitizedManga,
        coverUrl: sanitizedManga.coverUrl,
        coverImage: sanitizedManga.coverUrl
      });
      await setDoc(docRef, dataToUpdate, { merge: true });
    } catch (err) {
      console.error("Firestore updateManga error:", err);
      try {
        const fallbackCover = await compressDataUrl(sanitizedManga.coverUrl, 1600, 0.90);
        const safeData = sanitizeForFirestore({
          ...sanitizedManga,
          coverUrl: fallbackCover,
          coverImage: fallbackCover
        });
        await setDoc(doc(db, 'mangas', sanitizedManga.id), safeData, { merge: true });
      } catch (retryErr) {
        console.error("Firestore updateManga retry error:", retryErr);
      }
    }
  }
}

export async function deleteMangaFromDb(mangaId: string): Promise<void> {
  const targetId = String(mangaId || '').trim();
  addDeletedId('mangas', targetId);

  // Immediately update local caches and subscribers
  const list = getStoredMangas();
  const updated = list.filter(m => String(m.id || '').trim().toLowerCase() !== targetId.toLowerCase());
  triggerLocalUpdate('mangas', updated);

  const chList = getStoredChapters();
  const deletedChapters = chList.filter(c => String(c.mangaId || '').trim().toLowerCase() === targetId.toLowerCase());
  deletedChapters.forEach(c => addDeletedId('chapters', c.id));
  const updatedCh = chList.filter(c => String(c.mangaId || '').trim().toLowerCase() !== targetId.toLowerCase());
  triggerLocalUpdate('chapters', updatedCh);

  if (db) {
    try {
      const docRef = doc(db, 'mangas', targetId);
      await deleteDoc(docRef).catch(() => {});
      if (targetId.toLowerCase() !== targetId) {
        deleteDoc(doc(db, 'mangas', targetId.toLowerCase())).catch(() => {});
      }

      // Delete known local chapters first without needing a query
      for (const ch of deletedChapters) {
        deleteDoc(doc(db, 'chapters', ch.id)).catch(() => {});
        for (let i = 2; i <= 20; i++) {
          deleteDoc(doc(db, 'chapters', `${ch.id}_part${i}`)).catch(() => {});
        }
      }

      // Attempt to query remaining remote chapters with safe error handling
      try {
        const chSnaps = await getDocs(query(collection(db, 'chapters'), where('mangaId', '==', targetId)));
        chSnaps.forEach((docSnap) => {
          const cId = docSnap.id;
          addDeletedId('chapters', cId);
          deleteDoc(doc(db, 'chapters', cId)).catch(() => {});
          for (let i = 2; i <= 20; i++) {
            deleteDoc(doc(db, 'chapters', `${cId}_part${i}`)).catch(() => {});
          }
        });
      } catch (qErr: any) {
        if (qErr?.message?.includes('Quota') || qErr?.message?.includes('quota') || qErr?.code === 'resource-exhausted') {
          console.warn("Firestore quota notice during chapter cleanup (local deletion succeeded):", qErr.message);
        } else {
          console.warn("Firestore query chapter notice:", qErr);
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('Quota') || err?.message?.includes('quota') || err?.code === 'resource-exhausted') {
        console.warn("Firestore deleteManga quota limit reached (local deletion succeeded).");
      } else {
        console.error("Firestore deleteManga error:", err);
      }
    }
  }
}

// Memory & Session Cache for Single Chapter Details (Reduces Document Reads to 1 or 0)
const chapterDetailMemoryCache = new Map<string, { chapter: Chapter; timestamp: number }>();

export async function getChapterFromDb(chapterId: string): Promise<Chapter | null> {
  const targetId = String(chapterId || '').trim();
  if (!targetId) return null;

  const now = Date.now();
  const cached = chapterDetailMemoryCache.get(targetId.toLowerCase());
  if (cached && (now - cached.timestamp < 15 * 60 * 1000)) {
    return cached.chapter;
  }

  // 1. Check local in-memory/localStorage chapters first
  const localList = getStoredChapters();
  const localFound = localList.find(c => String(c.id || '').trim().toLowerCase() === targetId.toLowerCase());
  if (localFound && localFound.images && localFound.images.length > 0) {
    chapterDetailMemoryCache.set(targetId.toLowerCase(), { chapter: localFound, timestamp: now });
    return localFound;
  }

  // 2. Fetch single document from Firestore with persistent cache (1 single read)
  if (db) {
    try {
      const docRef = doc(db, 'chapters', targetId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const ch = {
          translator: '',
          editor: '',
          typesetter: '',
          isVip: false,
          ...data,
          id: snap.id,
          mangaId: data.mangaId || '',
          title: data.title || '',
          chapterNumber: typeof data.chapterNumber === 'number' ? data.chapterNumber : 1,
          images: Array.isArray(data.images) ? data.images : [],
          createdAt: data.createdAt || new Date().toISOString()
        } as unknown as Chapter;
        chapterDetailMemoryCache.set(targetId.toLowerCase(), { chapter: ch, timestamp: now });
        return ch;
      }
    } catch (err) {
      console.warn("getChapterFromDb cache notice:", err);
    }
  }

  return localFound || null;
}

// Atomic view increment using Firestore increment(1) - 0 read cost
export async function incrementMangaViewsInDb(mangaId: string): Promise<void> {
  const targetId = String(mangaId || '').trim();
  if (!targetId) return;

  // Optimistic local state update
  const list = getStoredMangas();
  const updated = list.map(m => {
    if (String(m.id || '').trim().toLowerCase() === targetId.toLowerCase()) {
      return { ...m, views: (m.views || 0) + 1 };
    }
    return m;
  });
  triggerLocalUpdate('mangas', updated);

  if (db) {
    try {
      const docRef = doc(db, 'mangas', targetId);
      await updateDoc(docRef, {
        views: increment(1)
      });
    } catch (err: any) {
      if (err?.code === 'not-found') {
        try {
          await setDoc(doc(db, 'mangas', targetId), { views: 1 }, { merge: true });
        } catch {}
      }
    }
  }
}

// Atomic like/save increment using Firestore increment(delta) - 0 read cost
export async function incrementMangaLikesInDb(mangaId: string, delta: number): Promise<void> {
  const targetId = String(mangaId || '').trim();
  if (!targetId || delta === 0) return;

  // Optimistic local state update
  const list = getStoredMangas();
  const updated = list.map(m => {
    if (String(m.id || '').trim().toLowerCase() === targetId.toLowerCase()) {
      return { ...m, likes: Math.max(0, (m.likes || 0) + delta) };
    }
    return m;
  });
  triggerLocalUpdate('mangas', updated);

  if (db) {
    try {
      const docRef = doc(db, 'mangas', targetId);
      await updateDoc(docRef, {
        likes: increment(delta)
      });
    } catch (err: any) {
      // Handled silently
    }
  }
}

export async function fitChapterImagesForFirestore(images: string[], targetMaxBytes = 700000): Promise<string[]> {
  if (!images || images.length === 0) return images;

  // First: attempt to convert any base64 Data URLs to uncompressed, permanent Cloud URLs in small batches
  let processedImages: string[] = [];
  const batchSize = 3;
  for (let i = 0; i < images.length; i += batchSize) {
    const chunk = images.slice(i, i + batchSize);
    const chunkResults = await Promise.all(
      chunk.map(async (p) => {
        if (!p || !p.startsWith('data:image/')) return p;
        return uploadDataUrlToCloud(p);
      })
    );
    processedImages.push(...chunkResults);
  }

  // Quick check if total size is now safe
  let currentJson = JSON.stringify(processedImages);
  if (currentJson.length <= targetMaxBytes) {
    return processedImages;
  }

  // Progressive fallback tiers for remaining local Data URLs
  const fallbackTiers = [
    { maxDim: 3200, quality: 0.98 },
    { maxDim: 2500, quality: 0.95 },
    { maxDim: 2000, quality: 0.90 },
    { maxDim: 1600, quality: 0.85 },
    { maxDim: 1300, quality: 0.80 },
    { maxDim: 1000, quality: 0.75 },
    { maxDim: 800, quality: 0.65 },
    { maxDim: 650, quality: 0.55 },
    { maxDim: 500, quality: 0.45 },
    { maxDim: 400, quality: 0.35 },
    { maxDim: 300, quality: 0.25 },
  ];

  let fitted = [...processedImages];
  for (const tier of fallbackTiers) {
    fitted = await Promise.all(
      fitted.map(async (p) => {
        if (!p || !p.startsWith('data:image/')) return p;
        return compressDataUrl(p, tier.maxDim, tier.quality);
      })
    );
    if (JSON.stringify(fitted).length <= targetMaxBytes) {
      break;
    }
  }

  // Ultimate fail-safe: if still oversized, perform emergency force compression
  if (JSON.stringify(fitted).length > targetMaxBytes) {
    fitted = await Promise.all(
      fitted.map(async (p) => {
        if (!p || !p.startsWith('data:image/')) return p;
        return compressDataUrl(p, 240, 0.20);
      })
    );
  }

  return fitted;
}

export async function addChapterToDb(
  chapter: Chapter,
  onProgress?: (percent: number, msg: string) => void
): Promise<void> {
  onProgress?.(52, '[52%] Бүлгийн мэдээлэл болон зургуудыг шалгаж байна...');
  const targetId = String(chapter.id || '').trim().toLowerCase();
  removeDeletedId('chapters', chapter.id);
  const rawImages = chapter.images || (chapter as any).pages || [];

  let sanitizedImages: string[] = [];
  const unuploaded = rawImages.filter(p => p && (p.startsWith('data:image/') || p.startsWith('blob:') || p.includes('localhost:3000')));

  if (unuploaded.length > 0) {
    onProgress?.(60, `[60%] Local зургуудыг Cloud руу эх хувиар нь хуулж байна...`);
    let processedCount = 0;
    const batchSize = 6;
    for (let i = 0; i < rawImages.length; i += batchSize) {
      const chunk = rawImages.slice(i, i + batchSize);
      const chunkResults = await Promise.all(
        chunk.map(async (p: string) => {
          if (!p) return p;
          let current = p.trim();
          if (current.includes('localhost:3000')) {
            current = current.replace(/http:\/\/localhost:3000/g, '');
          }
          if (current.startsWith('data:image/') || current.startsWith('blob:')) {
            const cloudUrl = await uploadDataUrlToCloud(current);
            if (cloudUrl && (cloudUrl.startsWith('http://') || cloudUrl.startsWith('https://'))) {
              return cloudUrl;
            }
            if (cloudUrl && cloudUrl.startsWith('data:image/')) {
              return cloudUrl;
            }
            if (current.startsWith('blob:')) {
              return DEFAULT_FALLBACK_IMAGE;
            }
            return cloudUrl || current;
          }
          return current;
        })
      );
      sanitizedImages.push(...chunkResults);
      processedCount += chunk.length;
      const pct = Math.min(85, Math.round(60 + (processedCount / rawImages.length) * 25));
      onProgress?.(pct, `[${pct}%] [${processedCount}/${rawImages.length}] Зургийн линкүүдийг бэлтгэж байна...`);
    }
  } else {
    sanitizedImages = rawImages.map(p => {
      if (typeof p === 'string' && p.includes('localhost:3000')) {
        return p.replace(/http:\/\/localhost:3000/g, '');
      }
      return p;
    });
    onProgress?.(80, '[80%] Зургийн холбоосууд бэлэн боллоо...');
  }

  // Ensure posterUrl and createdAt timestamp exist and are sanitized
  const nowIso = new Date().toISOString();
  let sanitizedPoster = (chapter.posterUrl || '').trim();
  if (sanitizedPoster.includes('localhost:3000')) {
    sanitizedPoster = sanitizedPoster.replace(/http:\/\/localhost:3000/g, '');
  }
  if (sanitizedPoster.startsWith('blob:') || sanitizedPoster.startsWith('data:image/')) {
    try {
      const cloudUrl = await uploadDataUrlToCloud(sanitizedPoster);
      if (cloudUrl && (cloudUrl.startsWith('http://') || cloudUrl.startsWith('https://'))) {
        sanitizedPoster = cloudUrl;
      } else {
        sanitizedPoster = await compressDataUrl(sanitizedPoster, 1600, 0.88);
      }
    } catch {
      sanitizedPoster = await compressDataUrl(sanitizedPoster, 1400, 0.85);
    }
  }

  const chapterWithTime: Chapter = {
    ...chapter,
    posterUrl: sanitizedPoster || undefined,
    createdAt: chapter.createdAt || nowIso
  };

  const localChapter: Chapter = { ...chapterWithTime, images: sanitizedImages };
  const list = getStoredChapters();
  const updated = [localChapter, ...list.filter(c => String(c.id || '').trim().toLowerCase() !== targetId)];
  triggerLocalUpdate('chapters', updated);

  // Bump parent manga's updatedAt so it appears at top of updated list
  try {
    const parentManga = getStoredMangas().find(m => String(m.id || '').trim().toLowerCase() === String(chapterWithTime.mangaId || '').trim().toLowerCase());
    if (parentManga) {
      updateMangaInDb({
        ...parentManga,
        updatedAt: nowIso
      }).catch(() => {});
    }
  } catch (e) {}

  onProgress?.(92, '[92%] Firestore датабаазад нийтлэж байна...');

  if (db) {
    try {
      const imagesJsonLen = JSON.stringify(sanitizedImages).length;
      const mainDocRef = doc(db, 'chapters', chapter.id);

      if (imagesJsonLen <= 750000) {
        // Optimized: Single document storage (1 read, 1 write)
        await setDoc(mainDocRef, sanitizeForFirestore({
          ...chapterWithTime,
          images: sanitizedImages,
          totalParts: 1,
          hasParts: false,
          isPartDoc: false
        }), { merge: true });
        await cleanupChapterParts(chapter.id, 2, 30);
      } else {
        // Fallback only if raw base64 exceeds single doc limit
        const imageChunks = chunkChapterImages(sanitizedImages, 650000);
        await setDoc(mainDocRef, sanitizeForFirestore({
          ...chapterWithTime,
          images: imageChunks[0] || [],
          totalParts: imageChunks.length,
          hasParts: imageChunks.length > 1,
          isPartDoc: false
        }), { merge: true });

        for (let pIdx = 1; pIdx < imageChunks.length; pIdx++) {
          const partNum = pIdx + 1;
          const partDocId = `${chapter.id}_part${partNum}`;
          const partDocRef = doc(db, 'chapters', partDocId);
          await setDoc(partDocRef, sanitizeForFirestore({
            id: partDocId,
            isPartDoc: true,
            parentChapterId: chapter.id,
            partIndex: partNum,
            images: imageChunks[pIdx],
            mangaId: chapter.mangaId,
            createdAt: chapter.createdAt || nowIso
          }), { merge: true });
        }
        await cleanupChapterParts(chapter.id, imageChunks.length + 1, 30);
      }
      onProgress?.(98, '[98%] Датабаазад амжилттай бичигдлээ!');
    } catch (err: any) {
      console.error("Firestore addChapter error:", err);
    }
  }
}

export async function updateChapterInDb(
  chapter: Chapter,
  onProgress?: (percent: number, msg: string) => void
): Promise<void> {
  onProgress?.(52, '[52%] Бүлгийн мэдээллийг шинэчлэж байна...');
  const targetId = String(chapter.id || '').trim().toLowerCase();
  removeDeletedId('chapters', chapter.id);
  const rawImages = chapter.images || (chapter as any).pages || [];

  let sanitizedImages: string[] = [];
  const unuploaded = rawImages.filter(p => p && (p.startsWith('data:image/') || p.startsWith('blob:')));

  if (unuploaded.length > 0) {
    onProgress?.(60, '[60%] Local зургуудыг Cloud руу хуулж байна...');
    let processedCount = 0;
    const batchSize = 6;
    for (let i = 0; i < rawImages.length; i += batchSize) {
      const chunk = rawImages.slice(i, i + batchSize);
      const chunkResults = await Promise.all(
        chunk.map(async (p: string) => {
          if (!p) return p;
          if (p.startsWith('data:image/') || p.startsWith('blob:')) {
            const cloudUrl = await uploadDataUrlToCloud(p);
            if (cloudUrl && (cloudUrl.startsWith('http://') || cloudUrl.startsWith('https://') || cloudUrl.startsWith('/uploads/'))) {
              return cloudUrl;
            }
            if (cloudUrl && cloudUrl.startsWith('data:image/')) {
              return cloudUrl;
            }
            return cloudUrl || p;
          }
          return p;
        })
      );
      sanitizedImages.push(...chunkResults);
      processedCount += chunk.length;
      const pct = Math.min(85, Math.round(60 + (processedCount / rawImages.length) * 25));
      onProgress?.(pct, `[${pct}%] [${processedCount}/${rawImages.length}] Зургуудыг бэлтгэж байна...`);
    }
  } else {
    sanitizedImages = [...rawImages];
    onProgress?.(80, '[80%] Зургийн холбоосууд бэлэн боллоо...');
  }

  const nowIso = new Date().toISOString();
  let sanitizedPoster = (chapter.posterUrl || '').trim();
  if (sanitizedPoster.startsWith('blob:') || sanitizedPoster.startsWith('data:image/')) {
    try {
      const cloudUrl = await uploadDataUrlToCloud(sanitizedPoster);
      if (cloudUrl && (cloudUrl.startsWith('http') || cloudUrl.startsWith('/uploads/'))) {
        sanitizedPoster = cloudUrl;
      } else {
        sanitizedPoster = await compressDataUrl(sanitizedPoster, 2400, 0.95);
      }
    } catch {
      sanitizedPoster = await compressDataUrl(sanitizedPoster, 2000, 0.92);
    }
  }

  const chapterWithTime: Chapter = {
    ...chapter,
    posterUrl: sanitizedPoster || undefined,
    createdAt: chapter.createdAt || nowIso
  };

  const localChapter: Chapter = { ...chapterWithTime, images: sanitizedImages };
  const list = getStoredChapters();
  let found = false;
  const updated = list.map(ch => {
    if (String(ch.id || '').trim().toLowerCase() === targetId) {
      found = true;
      return localChapter;
    }
    return ch;
  });
  if (!found) {
    updated.unshift(localChapter);
  }
  triggerLocalUpdate('chapters', updated);

  // Bump parent manga's updatedAt
  try {
    const parentManga = getStoredMangas().find(m => String(m.id || '').trim().toLowerCase() === String(chapterWithTime.mangaId || '').trim().toLowerCase());
    if (parentManga) {
      updateMangaInDb({
        ...parentManga,
        updatedAt: nowIso
      }).catch(() => {});
    }
  } catch (e) {}

  onProgress?.(92, '[92%] Датабаазад шинэчлэлийг хадгалж байна...');

  if (db) {
    try {
      const imagesJsonLen = JSON.stringify(sanitizedImages).length;
      const mainDocRef = doc(db, 'chapters', chapter.id);

      if (imagesJsonLen <= 750000) {
        // Optimized: Single document storage (1 read, 1 write)
        await setDoc(mainDocRef, sanitizeForFirestore({
          ...chapterWithTime,
          images: sanitizedImages,
          totalParts: 1,
          hasParts: false,
          isPartDoc: false
        }), { merge: true });
        await cleanupChapterParts(chapter.id, 2, 30);
      } else {
        // Fallback only if raw base64 exceeds single doc limit
        const imageChunks = chunkChapterImages(sanitizedImages, 650000);
        await setDoc(mainDocRef, sanitizeForFirestore({
          ...chapterWithTime,
          images: imageChunks[0] || [],
          totalParts: imageChunks.length,
          hasParts: imageChunks.length > 1,
          isPartDoc: false
        }), { merge: true });

        for (let pIdx = 1; pIdx < imageChunks.length; pIdx++) {
          const partNum = pIdx + 1;
          const partDocId = `${chapter.id}_part${partNum}`;
          const partDocRef = doc(db, 'chapters', partDocId);
          await setDoc(partDocRef, sanitizeForFirestore({
            id: partDocId,
            isPartDoc: true,
            parentChapterId: chapter.id,
            partIndex: partNum,
            images: imageChunks[pIdx],
            mangaId: chapter.mangaId,
            createdAt: chapter.createdAt || nowIso
          }), { merge: true });
        }
        await cleanupChapterParts(chapter.id, imageChunks.length + 1, 30);
      }
      onProgress?.(98, '[98%] Датабаазад амжилттай шинэчлэгдлээ!');
    } catch (err: any) {
      console.error("Firestore updateChapter error:", err);
    }
  }
}

export async function deleteChapterFromDb(chapterId: string): Promise<void> {
  const targetId = String(chapterId || '').trim();
  addDeletedId('chapters', targetId);

  if (db) {
    try {
      const docRef = doc(db, 'chapters', targetId);
      await deleteDoc(docRef);
      if (targetId.toLowerCase() !== targetId) {
        deleteDoc(doc(db, 'chapters', targetId.toLowerCase())).catch(() => {});
      }
      for (let i = 2; i <= 20; i++) {
        deleteDoc(doc(db, 'chapters', `${targetId}_part${i}`)).catch(() => {});
        if (targetId.toLowerCase() !== targetId) {
          deleteDoc(doc(db, 'chapters', `${targetId.toLowerCase()}_part${i}`)).catch(() => {});
        }
      }
    } catch (err) {
      console.error("Firestore deleteChapter error:", err);
    }
  }

  const list = getStoredChapters();
  const updated = list.filter(c => String(c.id || '').trim().toLowerCase() !== targetId.toLowerCase());
  triggerLocalUpdate('chapters', updated);
}

export async function deleteChaptersBatchFromDb(chapterIds: string[]): Promise<void> {
  if (!chapterIds || chapterIds.length === 0) return;
  const lowerSet = new Set(chapterIds.map(id => String(id || '').trim().toLowerCase()));
  chapterIds.forEach(id => addDeletedId('chapters', id));

  const list = getStoredChapters();
  const updated = list.filter(c => !lowerSet.has(String(c.id || '').trim().toLowerCase()));
  triggerLocalUpdate('chapters', updated);

  if (db) {
    try {
      await Promise.all(chapterIds.flatMap(id => {
        const promises = [
          deleteDoc(doc(db, 'chapters', id)).catch(() => {}),
          deleteDoc(doc(db, 'chapters', id.toLowerCase())).catch(() => {})
        ];
        for (let i = 2; i <= 20; i++) {
          promises.push(deleteDoc(doc(db, 'chapters', `${id}_part${i}`)).catch(() => {}));
          promises.push(deleteDoc(doc(db, 'chapters', `${id.toLowerCase()}_part${i}`)).catch(() => {}));
        }
        return promises;
      }));
    } catch (err) {
      console.error("Firestore deleteChaptersBatch error:", err);
    }
  }
}

export async function saveUserToDb(user: User): Promise<void> {
  const list = getLocalData<User>('users', []);
  const exists = list.some(u => u.id === user.id);
  const updated = exists ? list.map(u => u.id === user.id ? user : u) : [...list, user];
  triggerLocalUpdate('users', updated);

  if (db) {
    try {
      const docRef = doc(db, 'users', user.id);
      await setDoc(docRef, sanitizeForFirestore(user), { merge: true });
    } catch (err) {
      console.warn("Firestore saveUser notice:", err);
    }
  }
}

export async function deleteUserFromDb(userId: string): Promise<void> {
  const list = getLocalData<User>('users', []);
  const updated = list.filter(u => u.id !== userId);
  triggerLocalUpdate('users', updated);

  if (db) {
    try {
      const docRef = doc(db, 'users', userId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn("Firestore deleteUser notice:", err);
    }
  }
}

export async function addVipRequestToDb(request: VipRequest): Promise<void> {
  const list = getLocalData<VipRequest>('vipRequests', []);
  const updated = [request, ...list.filter(r => r.id !== request.id)];
  triggerLocalUpdate('vipRequests', updated);

  if (db) {
    try {
      const docRef = doc(db, 'vipRequests', request.id);
      await setDoc(docRef, sanitizeForFirestore(request));
    } catch (err) {
      console.warn("Firestore addVipRequest notice:", err);
    }
  }
}

export async function updateVipRequestInDb(request: VipRequest): Promise<void> {
  const list = getLocalData<VipRequest>('vipRequests', []);
  const updated = list.map(r => r.id === request.id ? request : r);
  triggerLocalUpdate('vipRequests', updated);

  if (db) {
    try {
      const docRef = doc(db, 'vipRequests', request.id);
      await setDoc(docRef, sanitizeForFirestore(request), { merge: true });
    } catch (err) {
      console.warn("Firestore updateVipRequest notice:", err);
    }
  }
}

export async function deleteVipRequestFromDb(requestId: string): Promise<void> {
  const list = getLocalData<VipRequest>('vipRequests', []);
  const updated = list.filter(r => r.id !== requestId);
  triggerLocalUpdate('vipRequests', updated);

  if (db) {
    try {
      const docRef = doc(db, 'vipRequests', requestId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn("Firestore deleteVipRequest notice:", err);
    }
  }
}

export function subscribeToGenres(callback: (genres: string[]) => void): () => void {
  if (!listeners.genres.includes(callback)) {
    listeners.genres.push(callback);
  }
  const cleanupLocal = () => {
    listeners.genres = listeners.genres.filter(cb => cb !== callback);
  };

  const localActive = getLocalData<string>('genres', DEFAULT_GENRES);
  const localDeleted = getLocalData<string>('deleted_genres', []);
  const initialFiltered = Array.from(new Set(localActive.filter(g => !localDeleted.includes(g))));
  callback(initialFiltered);

  if (!db) {
    return cleanupLocal;
  }

  let activeList: string[] = [];
  let deletedList: string[] = [];

  const updateCombined = () => {
    const merged = DEFAULT_GENRES.filter(g => !deletedList.includes(g)).concat(activeList);
    const unique = Array.from(new Set(merged));
    triggerLocalUpdate('genres', unique);
  };

  const unsubActive = onSnapshot(collection(db, 'genres'), (snapshot) => {
    const list: string[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.name) {
        list.push(data.name);
      } else if (docSnap.id) {
        list.push(docSnap.id);
      }
    });
    activeList = list;
    updateCombined();
  }, (error) => {
    console.warn("Firestore subscription error for genres:", error);
  });

  const unsubDeleted = onSnapshot(collection(db, 'deleted_genres'), (snapshot) => {
    const list: string[] = [];
    snapshot.forEach((docSnap) => {
      if (docSnap.id) list.push(docSnap.id);
    });
    deletedList = list;
    updateCombined();
  }, (error) => {
    console.warn("Firestore subscription error for deleted_genres:", error);
  });

  return () => {
    unsubActive();
    unsubDeleted();
    cleanupLocal();
  };
}

export async function addGenreToDb(genreName: string): Promise<void> {
  const trimmed = genreName.trim();
  if (!trimmed) return;
  if (db) {
    try {
      await setDoc(doc(db, 'genres', trimmed), { name: trimmed, createdAt: new Date().toISOString() });
      await deleteDoc(doc(db, 'deleted_genres', trimmed));
    } catch (err) {
      console.error('Error adding genre to Firestore:', err);
    }
  }
  const current = getLocalData<string>('genres', DEFAULT_GENRES);
  const currentDeleted = getLocalData<string>('deleted_genres', []);
  const updatedDeleted = currentDeleted.filter(g => g !== trimmed);
  const updatedGenres = Array.from(new Set([...current, trimmed]));

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('ayako_genres', JSON.stringify(updatedGenres));
      localStorage.setItem('ayako_deleted_genres', JSON.stringify(updatedDeleted));
    } catch (e) {}
  }
  triggerLocalUpdate('genres', updatedGenres);
}

export async function deleteGenreFromDb(genreName: string): Promise<void> {
  const trimmed = genreName.trim();
  if (!trimmed) return;
  if (db) {
    try {
      await deleteDoc(doc(db, 'genres', trimmed));
      await setDoc(doc(db, 'deleted_genres', trimmed), { name: trimmed, deletedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Error deleting genre from Firestore:', err);
    }
  }
  const current = getLocalData<string>('genres', DEFAULT_GENRES);
  const currentDeleted = getLocalData<string>('deleted_genres', []);
  const updatedGenres = current.filter(g => g !== trimmed);
  const updatedDeleted = Array.from(new Set([...currentDeleted, trimmed]));

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('ayako_genres', JSON.stringify(updatedGenres));
      localStorage.setItem('ayako_deleted_genres', JSON.stringify(updatedDeleted));
    } catch (e) {}
  }
  triggerLocalUpdate('genres', updatedGenres);
}

// ==================== MOVIES & EPISODES DATA SUBSCRIPTIONS & CRUD ====================

export function subscribeToMovies(callback: (movies: MovieItem[]) => void): () => void {
  if (!listeners.movies.includes(callback)) {
    listeners.movies.push(callback);
  }
  const cleanupLocal = () => {
    listeners.movies = listeners.movies.filter(cb => cb !== callback);
  };

  const cachedLocal = getLocalData<MovieItem>('movies', []);
  callback(cachedLocal);

  if (!db) {
    return cleanupLocal;
  }

  let firestoreUnsub: (() => void) | null = null;
  try {
    const colRef = collection(db, 'movies');
    firestoreUnsub = onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) {
        triggerLocalUpdate('movies', []);
        return;
      }

      const remoteList: MovieItem[] = [];
      snapshot.forEach((docSnap) => {
        const docId = docSnap.id;
        const data = docSnap.data();
        if (!data) return;
        remoteList.push({ ...data, id: docId } as MovieItem);
      });

      remoteList.sort((a, b) => {
        const timeA = parseTimestamp(a.updatedAt || a.createdAt);
        const timeB = parseTimestamp(b.updatedAt || b.createdAt);
        return timeB - timeA;
      });

      triggerLocalUpdate('movies', remoteList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'movies');
    });
  } catch (err) {
    console.warn("Movies subscription notice:", err);
  }

  return () => {
    if (firestoreUnsub) firestoreUnsub();
    cleanupLocal();
  };
}

export function subscribeToMovieEpisodes(callback: (episodes: MovieEpisode[]) => void): () => void {
  if (!listeners.movieEpisodes.includes(callback)) {
    listeners.movieEpisodes.push(callback);
  }
  const cleanupLocal = () => {
    listeners.movieEpisodes = listeners.movieEpisodes.filter(cb => cb !== callback);
  };

  const cachedLocal = getLocalData<MovieEpisode>('movieEpisodes', []);
  callback(cachedLocal);

  if (!db) {
    return cleanupLocal;
  }

  let firestoreUnsub: (() => void) | null = null;
  try {
    const colRef = collection(db, 'movieEpisodes');
    firestoreUnsub = onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) {
        triggerLocalUpdate('movieEpisodes', []);
        return;
      }

      const remoteList: MovieEpisode[] = [];
      snapshot.forEach((docSnap) => {
        const docId = docSnap.id;
        const data = docSnap.data();
        if (!data) return;
        remoteList.push({ ...data, id: docId } as MovieEpisode);
      });

      remoteList.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0));
      triggerLocalUpdate('movieEpisodes', remoteList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'movieEpisodes');
    });
  } catch (err) {
    console.warn("MovieEpisodes subscription notice:", err);
  }

  return () => {
    if (firestoreUnsub) firestoreUnsub();
    cleanupLocal();
  };
}

export async function addMovieToDb(movie: MovieItem): Promise<void> {
  const targetId = String(movie.id || '').trim();
  removeDeletedId('movies', targetId);
  const nowIso = new Date().toISOString();
  let sanitizedCover = movie.coverUrl || '';
  if (sanitizedCover.startsWith('data:image/')) {
    try {
      const cloudUrl = await uploadDataUrlToCloud(sanitizedCover);
      if (cloudUrl && (cloudUrl.startsWith('http') || cloudUrl.startsWith('/uploads/'))) {
        sanitizedCover = cloudUrl;
      } else {
        sanitizedCover = await compressDataUrl(sanitizedCover, 2400, 0.95);
      }
    } catch {
      sanitizedCover = await compressDataUrl(sanitizedCover, 2000, 0.92);
    }
  }

  const sanitizedMovie: MovieItem = {
    ...movie,
    coverUrl: sanitizedCover,
    createdAt: movie.createdAt || nowIso,
    updatedAt: nowIso
  };

  const localList = getLocalData<MovieItem>('movies', []);
  const updated = [sanitizedMovie, ...localList.filter(m => String(m.id || '').trim().toLowerCase() !== targetId.toLowerCase())];
  triggerLocalUpdate('movies', updated);

  if (db) {
    try {
      await setDoc(doc(db, 'movies', sanitizedMovie.id), sanitizeForFirestore(sanitizedMovie), { merge: true });
    } catch (err) {
      console.error('Error saving movie to Firestore:', err);
    }
  }
}

export async function deleteMovieFromDb(movieId: string): Promise<void> {
  const targetId = String(movieId || '').trim();
  addDeletedId('movies', targetId);

  const localList = getLocalData<MovieItem>('movies', []);
  const updated = localList.filter(m => String(m.id || '').trim().toLowerCase() !== targetId.toLowerCase());
  triggerLocalUpdate('movies', updated);

  const localEpisodes = getLocalData<MovieEpisode>('movieEpisodes', []);
  const deletedEps = localEpisodes.filter(e => String(e.movieId || '').trim().toLowerCase() === targetId.toLowerCase());
  deletedEps.forEach(e => addDeletedId('movieEpisodes', e.id));

  const updatedEpisodes = localEpisodes.filter(e => String(e.movieId || '').trim().toLowerCase() !== targetId.toLowerCase());
  triggerLocalUpdate('movieEpisodes', updatedEpisodes);

  if (db) {
    try {
      await deleteDoc(doc(db, 'movies', targetId)).catch(() => {});
      if (targetId.toLowerCase() !== targetId) {
        deleteDoc(doc(db, 'movies', targetId.toLowerCase())).catch(() => {});
      }
      for (const ep of deletedEps) {
        deleteDoc(doc(db, 'movieEpisodes', ep.id)).catch(() => {});
      }
      try {
        const epSnaps = await getDocs(query(collection(db, 'movieEpisodes'), where('movieId', '==', movieId)));
        epSnaps.forEach((docSnap) => {
          addDeletedId('movieEpisodes', docSnap.id);
          deleteDoc(doc(db, 'movieEpisodes', docSnap.id)).catch(() => {});
        });
      } catch (qErr: any) {
        if (qErr?.message?.includes('Quota') || qErr?.message?.includes('quota') || qErr?.code === 'resource-exhausted') {
          console.warn("Firestore quota notice during movie episodes cleanup (local deletion succeeded):", qErr.message);
        } else {
          console.warn("Firestore query movie episodes notice:", qErr);
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('Quota') || err?.message?.includes('quota') || err?.code === 'resource-exhausted') {
        console.warn("Firestore deleteMovie quota limit reached (local deletion succeeded).");
      } else {
        console.error('Error deleting movie from Firestore:', err);
      }
    }
  }
}

export async function addMovieEpisodeToDb(episode: MovieEpisode): Promise<void> {
  const targetId = String(episode.id || '').trim();
  removeDeletedId('movieEpisodes', targetId);

  const nowIso = new Date().toISOString();
  const sanitizedEpisode: MovieEpisode = {
    ...episode,
    createdAt: episode.createdAt || nowIso
  };

  const localEpisodes = getLocalData<MovieEpisode>('movieEpisodes', []);
  const updated = [sanitizedEpisode, ...localEpisodes.filter(e => String(e.id || '').trim().toLowerCase() !== targetId.toLowerCase())];
  triggerLocalUpdate('movieEpisodes', updated);

  if (db) {
    try {
      await setDoc(doc(db, 'movieEpisodes', sanitizedEpisode.id), sanitizeForFirestore(sanitizedEpisode), { merge: true });
    } catch (err) {
      console.error('Error saving movie episode to Firestore:', err);
    }
  }
}

export async function updateMovieInDb(movie: MovieItem): Promise<void> {
  const targetId = String(movie.id || '').trim();
  removeDeletedId('movies', targetId);

  const nowIso = new Date().toISOString();
  let sanitizedCover = movie.coverUrl || DEFAULT_FALLBACK_IMAGE;

  if (sanitizedCover.startsWith('data:image/')) {
    try {
      const cloudUrl = await uploadDataUrlToCloud(sanitizedCover);
      if (cloudUrl && (cloudUrl.startsWith('http') || cloudUrl.startsWith('/uploads/'))) {
        sanitizedCover = cloudUrl;
      } else {
        sanitizedCover = await compressDataUrl(sanitizedCover, 2400, 0.95);
      }
    } catch {
      sanitizedCover = await compressDataUrl(sanitizedCover, 2000, 0.92);
    }
  }

  const sanitizedMovie: MovieItem = {
    ...movie,
    coverUrl: sanitizedCover,
    updatedAt: nowIso
  };

  const localList = getLocalData<MovieItem>('movies', []);
  const updated = localList.map(m => String(m.id || '').trim().toLowerCase() === targetId.toLowerCase() ? sanitizedMovie : m);
  triggerLocalUpdate('movies', updated);

  if (db) {
    try {
      await setDoc(doc(db, 'movies', sanitizedMovie.id), sanitizeForFirestore(sanitizedMovie), { merge: true });
    } catch (err) {
      console.error('Error updating movie in Firestore:', err);
    }
  }
}

export async function deleteMovieEpisodeFromDb(episodeId: string): Promise<void> {
  const targetId = String(episodeId || '').trim();
  addDeletedId('movieEpisodes', targetId);

  const localEpisodes = getLocalData<MovieEpisode>('movieEpisodes', []);
  const updated = localEpisodes.filter(e => String(e.id || '').trim().toLowerCase() !== targetId.toLowerCase());
  triggerLocalUpdate('movieEpisodes', updated);

  if (db) {
    try {
      await deleteDoc(doc(db, 'movieEpisodes', targetId));
      if (targetId.toLowerCase() !== targetId) {
        deleteDoc(doc(db, 'movieEpisodes', targetId.toLowerCase())).catch(() => {});
      }
    } catch (err) {
      console.error('Error deleting movie episode from Firestore:', err);
    }
  }
}

export async function deleteMovieEpisodesBatchFromDb(episodeIds: string[]): Promise<void> {
  if (!episodeIds || episodeIds.length === 0) return;
  episodeIds.forEach(id => addDeletedId('movieEpisodes', id));

  const lowerSet = new Set(episodeIds.map(id => String(id || '').trim().toLowerCase()));
  const localEpisodes = getLocalData<MovieEpisode>('movieEpisodes', []);
  const updated = localEpisodes.filter(e => !lowerSet.has(String(e.id || '').trim().toLowerCase()));
  triggerLocalUpdate('movieEpisodes', updated);

  if (db) {
    try {
      await Promise.all(episodeIds.map(id => deleteDoc(doc(db, 'movieEpisodes', id)).catch(() => {})));
    } catch (err) {
      console.error('Error batch deleting movie episodes from Firestore:', err);
    }
  }
}


