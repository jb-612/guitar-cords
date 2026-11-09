import type { SyncBackend, SyncUser } from '../sync/backend';
import type { RemoteSong } from '../sync/merge';
import type { ChordChoice, Song } from '../song/song';

/** In-memory cloud: one account (password "secret1"), song docs with tombstones, live watchers. */
export class FakeCloud implements SyncBackend {
  configured = true;
  songs = new Map<string, RemoteSong>();
  chords: ChordChoice[] = [];
  private user: SyncUser | null = null;
  private userListeners = new Set<(u: SyncUser | null) => void>();
  private watchers = new Set<(songs: RemoteSong[]) => void>();

  private setUser(u: SyncUser | null) {
    this.user = u;
    this.userListeners.forEach((l) => l(u));
  }

  private notify() {
    const all = [...this.songs.values()];
    this.watchers.forEach((w) => w(all));
  }

  onUser = (l: (u: SyncUser | null) => void) => {
    this.userListeners.add(l);
    l(this.user);
    return () => void this.userListeners.delete(l);
  };

  signInWithGoogle = async () => this.setUser({ uid: 'u1', email: 'me@example.com', name: 'Me' });

  signInWithEmail = async (email: string, password: string) => {
    if (password !== 'secret1') throw Object.assign(new Error('bad'), { code: 'auth/wrong-password' });
    this.setUser({ uid: 'u1', email, name: null });
  };

  signOut = async () => this.setUser(null);
  fetchSongs = async () => [...this.songs.values()];

  watchSongs = (_uid: string, l: (songs: RemoteSong[]) => void) => {
    this.watchers.add(l);
    return () => void this.watchers.delete(l);
  };

  saveSong = async (_uid: string, song: Song) => {
    this.songs.set(song.id, { song, deleted: false });
    this.notify();
  };

  deleteSong = async (_uid: string, id: string, at: number) => {
    const existing = this.songs.get(id);
    if (existing) this.songs.set(id, { song: { ...existing.song, updatedAt: at }, deleted: true });
    this.notify();
  };

  fetchChords = async () => this.chords;
  saveChords = async (_uid: string, chords: ChordChoice[]) => {
    this.chords = chords;
  };

  /** Simulate an edit made on another device. */
  remoteEdit(song: Song) {
    this.songs.set(song.id, { song, deleted: false });
    this.notify();
  }
}
