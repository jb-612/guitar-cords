/**
 * Keeps the library and My chords in step with the cloud while signed in:
 * merge on sign-in, upload local edits and deletes (debounced), apply changes
 * from other devices as they arrive. Signed out, everything stays on this device.
 */
import { useContext, useEffect, useRef, useState } from 'react';
import { createLibrary, type Library } from '../library/library';
import type { LibraryApi } from '../library/useLibrary';
import type { ChordChoice, Song } from '../song/song';
import { SyncContext, type SyncBackend, type SyncUser } from './backend';
import { changedSince, mergeChords, mergeSongs, type RemoteSong } from './merge';

export type SyncStatus = 'local' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error';

const PUSH_DELAY_MS = 600;

interface Chords {
  myChords: ChordChoice[];
  replaceAll: (c: ChordChoice[]) => void;
}

/** Library after a merge: keep the open song if it survived, else open the first. */
function mergedLibrary(lib: Library, songs: Song[]): Library {
  if (songs.length === 0) return createLibrary();
  const currentId = songs.some((s) => s.id === lib.currentId) ? lib.currentId : songs[0]!.id;
  return { currentId, songs, deleted: [] };
}

/** Did a merge change anything this device shows? */
const differs = (before: Song[], after: Song[]) =>
  before.length !== after.length || after.some((s) => before.find((b) => b.id === s.id)?.updatedAt !== s.updatedAt);

/** Messages for the auth errors people actually hit. */
const AUTH_ERRORS: Record<string, string> = {
  'auth/wrong-password': 'Wrong password.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email — create one?',
  'auth/email-already-in-use': 'There is already an account with that email. Sign in instead.',
  'auth/weak-password': 'Use at least 6 characters for the password.',
  'auth/invalid-email': 'That email address does not look right.',
  'auth/network-request-failed': 'No connection. Try again when you are online.',
  'auth/popup-closed-by-user': 'Sign-in window was closed.',
};

export const authMessage = (e: unknown) => AUTH_ERRORS[(e as { code?: string })?.code ?? ''] ?? (e instanceof Error ? e.message : 'Something went wrong.');

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine ?? true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

interface Session {
  backend: SyncBackend;
  library: LibraryApi;
  chords: Chords;
  libRef: { current: Library };
  syncedAt: { current: Map<string, number> };
}

/** First sync after sign-in: merge both ways, then follow the cloud live. */
function startSession(s: Session, uid: string, setStatus: (st: SyncStatus) => void, setError: (e: string | null) => void) {
  let cancelled = false;
  const apply = (remote: RemoteSong[]) => {
    const lib = s.libRef.current;
    const merged = mergeSongs(lib.songs, remote, new Set(lib.deleted ?? []));
    merged.songs.forEach((song) => s.syncedAt.current.set(song.id, song.updatedAt ?? 0));
    if (differs(lib.songs, merged.songs)) s.library.replaceLibrary(mergedLibrary(lib, merged.songs));
    return merged;
  };
  setStatus('syncing');
  (async () => {
    const merged = apply(await s.backend.fetchSongs(uid));
    await Promise.all([...merged.toPush.map((song) => s.backend.saveSong(uid, song)), ...merged.toDelete.map((id) => s.backend.deleteSong(uid, id, Date.now()))]);
    const chords = mergeChords(s.chords.myChords, await s.backend.fetchChords(uid));
    s.chords.replaceAll(chords);
    await s.backend.saveChords(uid, chords);
    if (!cancelled) setStatus('synced');
  })().catch((e) => {
    setError(authMessage(e));
    setStatus('error');
  });
  const off = s.backend.watchSongs(uid, (remote) => void apply(remote));
  return () => {
    cancelled = true;
    off();
  };
}

/** Upload songs edited (or deleted) since their last sync. */
async function pushChanges(s: Session, uid: string) {
  const lib = s.libRef.current;
  const deleted = lib.deleted ?? [];
  for (const song of changedSince(lib.songs, s.syncedAt.current)) {
    await s.backend.saveSong(uid, song);
    s.syncedAt.current.set(song.id, song.updatedAt ?? 0);
  }
  await Promise.all(deleted.map((id) => s.backend.deleteSong(uid, id, Date.now())));
  if (deleted.length) s.library.forgetDeleted(deleted);
}

/** What the account button and sheet show. */
function visibleStatus(s: { signedIn: boolean; online: boolean; status: SyncStatus; configured: boolean }): SyncStatus {
  if (!s.signedIn) return s.configured ? 'signed-out' : 'local';
  return s.online ? s.status : 'offline';
}

export function useSync(library: LibraryApi, chords: Chords) {
  const create = useContext(SyncContext);
  const [backend] = useState(create);
  const [user, setUser] = useState<SyncUser | null>(null);
  const [status, setStatus] = useState<SyncStatus>(backend.configured ? 'signed-out' : 'local');
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();
  const libRef = useRef(library.lib);
  const syncedAt = useRef(new Map<string, number>());
  const session: Session = { backend, library, chords, libRef, syncedAt };
  const sessionRef = useRef(session);

  useEffect(() => {
    libRef.current = library.lib;
    sessionRef.current = session;
  });

  useEffect(() => backend.onUser(setUser), [backend]);

  useEffect(() => {
    if (!user) return;
    return startSession(sessionRef.current, user.uid, setStatus, setError);
  }, [user]);

  useEffect(() => {
    if (!user || status !== 'synced') return;
    const t = setTimeout(() => void pushChanges(sessionRef.current, user.uid).catch((e) => setError(authMessage(e))), PUSH_DELAY_MS);
    return () => clearTimeout(t);
  }, [library.lib, user, status]);

  useEffect(() => {
    if (!user || status !== 'synced') return;
    const t = setTimeout(() => void backend.saveChords(user.uid, chords.myChords).catch(() => {}), PUSH_DELAY_MS);
    return () => clearTimeout(t);
  }, [chords.myChords, user, status, backend]);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    return fn().catch((e) => setError(authMessage(e)));
  };

  return {
    configured: backend.configured,
    user,
    status: visibleStatus({ signedIn: !!user, online, status, configured: backend.configured }),
    error,
    signInWithGoogle: () => run(backend.signInWithGoogle),
    signInWithEmail: (email: string, password: string, create: boolean) => run(() => backend.signInWithEmail(email, password, create)),
    signOut: () =>
      run(async () => {
        await backend.signOut();
        syncedAt.current.clear();
        setStatus('signed-out');
      }),
  };
}

export type SyncApi = ReturnType<typeof useSync>;
