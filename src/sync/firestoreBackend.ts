/**
 * Firebase implementation of SyncBackend.
 * Data: users/{uid}/songs/{songId} = { data: JSON song, updatedAt, deleted }
 *       users/{uid}/meta/chords     = { data: JSON My chords }
 * Songs are stored as JSON text so nested arrays and undefined fields never trip Firestore.
 * Firestore's offline cache keeps working without a connection and syncs later.
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, initializeFirestore, onSnapshot, persistentLocalCache, setDoc, type DocumentData } from 'firebase/firestore';
import type { ChordChoice, Song } from '../song/song';
import type { SyncBackend } from './backend';
import type { RemoteSong } from './merge';

const toRemote = (d: DocumentData): RemoteSong => ({ song: JSON.parse(d.data as string) as Song, deleted: d.deleted === true });

/** Firestore with the offline cache; if this page already set it up (hot reload), reuse that instance. */
function firestoreFor(app: FirebaseApp) {
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache() });
  } catch {
    return getFirestore(app);
  }
}

export function createFirestoreBackend(config: Record<string, string | undefined>): SyncBackend {
  const app = getApps()[0] ?? initializeApp(config);
  const auth = getAuth(app);
  const db = firestoreFor(app);
  const songs = (uid: string) => collection(db, 'users', uid, 'songs');
  const chordsDoc = (uid: string) => doc(db, 'users', uid, 'meta', 'chords');

  return {
    configured: true,
    onUser: (listener) =>
      onAuthStateChanged(auth, (u) => listener(u ? { uid: u.uid, email: u.email, name: u.displayName } : null)),
    signInWithGoogle: async () => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signInWithEmail: async (email, password, createAccount) => {
      await (createAccount ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(auth, email, password);
    },
    signOut: () => signOut(auth),
    fetchSongs: async (uid) => (await getDocs(songs(uid))).docs.map((d) => toRemote(d.data())),
    watchSongs: (uid, listener) => onSnapshot(songs(uid), (snap) => listener(snap.docs.map((d) => toRemote(d.data())))),
    saveSong: (uid, song) => setDoc(doc(songs(uid), song.id), { data: JSON.stringify(song), updatedAt: song.updatedAt ?? Date.now(), deleted: false }),
    deleteSong: async (uid, id, at) => {
      const ref = doc(songs(uid), id);
      const existing = await getDoc(ref);
      const data = existing.exists() ? (existing.data().data as string) : JSON.stringify({ id, title: '', bars: [] });
      const tomb = { ...(JSON.parse(data) as Song), updatedAt: at };
      await setDoc(ref, { data: JSON.stringify(tomb), updatedAt: at, deleted: true });
    },
    fetchChords: async (uid) => {
      const snap = await getDoc(chordsDoc(uid));
      return snap.exists() ? (JSON.parse(snap.data().data as string) as ChordChoice[]) : [];
    },
    saveChords: (uid, chords) => setDoc(chordsDoc(uid), { data: JSON.stringify(chords) }),
  };
}
