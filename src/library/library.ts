/**
 * The creator's songs. One song is open at a time; edits go to it through
 * `updateCurrent`. Pure functions; persistence lives in useLibrary / sync.
 */
import { createSong, migrateSong, type Song } from '../song/song';

export interface Library {
  currentId: string;
  songs: Song[];
  /** Ids deleted on this device and not yet deleted in the cloud. */
  deleted?: string[];
}

const now = () => Date.now();
const stamp = (s: Song): Song => ({ ...s, updatedAt: now() });
const newId = () => crypto.randomUUID();

export function createLibrary(first: Song = createSong()): Library {
  const song = stamp(first);
  return { currentId: song.id, songs: [song] };
}

export const currentSong = (lib: Library): Song => lib.songs.find((s) => s.id === lib.currentId) ?? lib.songs[0]!;

export function addSong(lib: Library, song: Song): Library {
  const s = stamp(song);
  return { currentId: s.id, songs: [...lib.songs, s] };
}

export const openSong = (lib: Library, id: string): Library => (lib.songs.some((s) => s.id === id) ? { ...lib, currentId: id } : lib);

const mapSong = (lib: Library, id: string, fn: (s: Song) => Song): Library => ({
  ...lib,
  songs: lib.songs.map((s) => (s.id === id ? stamp(fn(s)) : s)),
});

export const updateCurrent = (lib: Library, fn: (s: Song) => Song): Library => mapSong(lib, currentSong(lib).id, fn);

/** Replace a song wholesale (e.g. from sync), without restamping it. */
export const putSong = (lib: Library, song: Song): Library =>
  lib.songs.some((s) => s.id === song.id) ? { ...lib, songs: lib.songs.map((s) => (s.id === song.id ? song : s)) } : { ...lib, songs: [...lib.songs, song] };

export function renameSong(lib: Library, id: string, title: string): Library {
  const clean = title.trim();
  return clean ? mapSong(lib, id, (s) => ({ ...s, title: clean })) : lib;
}

/** Deep copy with fresh ids so editing one never touches the other. */
function copyOf(song: Song): Song {
  return {
    ...structuredClone(song),
    id: newId(),
    title: `${song.title} (copy)`,
    bars: song.bars.map((b) => ({ ...structuredClone(b), id: newId(), events: b.events.map((e) => ({ ...structuredClone(e), id: newId() })) })),
  };
}

export function duplicateSong(lib: Library, id: string): Library {
  const i = lib.songs.findIndex((s) => s.id === id);
  if (i < 0) return lib;
  const copy = stamp(copyOf(lib.songs[i]!));
  return { currentId: copy.id, songs: [...lib.songs.slice(0, i + 1), copy, ...lib.songs.slice(i + 1)] };
}

/** Delete a song. The open one hands over to its neighbour; the library is never empty. */
export function deleteSong(lib: Library, id: string): Library {
  const i = lib.songs.findIndex((s) => s.id === id);
  if (i < 0) return lib;
  const songs = lib.songs.filter((s) => s.id !== id);
  const deleted = [...(lib.deleted ?? []), id];
  if (songs.length === 0) return { ...createLibrary(), deleted };
  const currentId = lib.currentId === id ? songs[Math.min(i, songs.length - 1)]!.id : lib.currentId;
  return { currentId, songs, deleted };
}

/** Forget deletions that have reached the cloud. */
export const clearDeleted = (lib: Library, ids: string[]): Library => ({ ...lib, deleted: (lib.deleted ?? []).filter((id) => !ids.includes(id)) });

const parse = (text: string | null): unknown => {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

const storedCurrent = (r: Partial<Library>, songs: Song[]) => (typeof r.currentId === 'string' ? r.currentId : songs[0]!.id);

function fromStored(raw: unknown): Library | null {
  const r = raw as Partial<Library> | null;
  if (!r || !Array.isArray(r.songs)) return null;
  const songs = r.songs.map(migrateSong).filter((s): s is Song => s !== null);
  if (songs.length === 0) return null;
  return { currentId: storedCurrent(r, songs), songs, deleted: Array.isArray(r.deleted) ? r.deleted : [] };
}

/** Library from storage: the library itself, else the single song older versions saved, else a fresh one. */
export function migrateLibrary(storedLibrary: string | null, storedSingleSong: string | null): Library {
  const lib = fromStored(parse(storedLibrary));
  if (lib) return lib;
  const single = migrateSong(parse(storedSingleSong));
  return createLibrary(single ?? undefined);
}
