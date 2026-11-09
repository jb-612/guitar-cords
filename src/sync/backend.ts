/**
 * Cloud sync backend. The app talks only to this interface: `firestoreBackend.ts`
 * implements it with Firebase Auth + Firestore (only when configured via
 * VITE_FIREBASE_* env vars); tests use an in-memory fake.
 */
import { createContext } from 'react';
import type { ChordChoice, Song } from '../song/song';
import type { RemoteSong } from './merge';

export interface SyncUser {
  uid: string;
  email: string | null;
  name: string | null;
}

export interface SyncBackend {
  /** False when no Firebase project is configured: the app works on this device only. */
  configured: boolean;
  onUser(listener: (user: SyncUser | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string, password: string, createAccount: boolean): Promise<void>;
  signOut(): Promise<void>;
  fetchSongs(uid: string): Promise<RemoteSong[]>;
  watchSongs(uid: string, listener: (songs: RemoteSong[]) => void): () => void;
  saveSong(uid: string, song: Song): Promise<void>;
  /** Leave a tombstone so other devices delete it too. */
  deleteSong(uid: string, id: string, at: number): Promise<void>;
  fetchChords(uid: string): Promise<ChordChoice[]>;
  saveChords(uid: string, chords: ChordChoice[]): Promise<void>;
}

const env = import.meta.env;
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const isFirebaseConfigured = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

const notConfigured = () => Promise.reject(new Error('Cloud sync is not set up for this app.'));

/** Backend used when Firebase is not configured: never signed in. */
export const offlineBackend: SyncBackend = {
  configured: false,
  onUser: (listener) => {
    listener(null);
    return () => {};
  },
  signInWithGoogle: notConfigured,
  signInWithEmail: notConfigured,
  signOut: () => Promise.resolve(),
  fetchSongs: () => Promise.resolve([]),
  watchSongs: () => () => {},
  saveSong: notConfigured,
  deleteSong: notConfigured,
  fetchChords: () => Promise.resolve([]),
  saveChords: notConfigured,
};

/** Firestore when configured, else offline. Created lazily so Firebase only loads when used. */
export function defaultBackend(): SyncBackend {
  if (!isFirebaseConfigured()) return offlineBackend;
  return lazyFirestore();
}

type FirestoreModule = { createFirestoreBackend: (config: typeof firebaseConfig) => SyncBackend };
let shared: Promise<SyncBackend> | null = null;

/** Firebase may be initialised only once per page, so every caller shares one backend. */
export function sharedFirestore(load: () => Promise<FirestoreModule> = () => import('./firestoreBackend')): Promise<SyncBackend> {
  shared ??= load().then((m) => m.createFirestoreBackend(firebaseConfig));
  return shared;
}

function lazyFirestore(): SyncBackend {
  const real = sharedFirestore();
  const call =
    <K extends keyof SyncBackend>(k: K) =>
    (...args: unknown[]) =>
      real.then((b) => (b[k] as (...a: unknown[]) => unknown)(...args));
  const subscribe =
    (k: 'onUser' | 'watchSongs') =>
    (...args: unknown[]) => {
      let off: (() => void) | undefined;
      let cancelled = false;
      void real.then((b) => {
        if (!cancelled) off = (b[k] as (...a: unknown[]) => () => void)(...args);
      });
      return () => {
        cancelled = true;
        off?.();
      };
    };
  return {
    configured: true,
    onUser: subscribe('onUser'),
    watchSongs: subscribe('watchSongs'),
    signInWithGoogle: call('signInWithGoogle'),
    signInWithEmail: call('signInWithEmail'),
    signOut: call('signOut'),
    fetchSongs: call('fetchSongs'),
    saveSong: call('saveSong'),
    deleteSong: call('deleteSong'),
    fetchChords: call('fetchChords'),
    saveChords: call('saveChords'),
  } as SyncBackend;
}

export const SyncContext = createContext<() => SyncBackend>(defaultBackend);
