/**
 * Merging this device's library with the cloud copy. Per song, the newer edit
 * (updatedAt) wins. Deletes travel as tombstones so a song removed on one device
 * doesn't come back from another — unless it was edited after the delete.
 */
import { toFretString } from '../music/chordShape';
import type { ChordChoice, Song } from '../song/song';

export interface RemoteSong {
  song: Song;
  /** Tombstone: deleted at `song.updatedAt`. */
  deleted: boolean;
}

export interface MergeResult {
  songs: Song[];
  /** Local songs newer than the cloud: upload them. */
  toPush: Song[];
  /** Deleted here, still in the cloud: delete them there. */
  toDelete: string[];
}

const at = (s: Song) => s.updatedAt ?? 0;

/** One song id: which version survives, and what must be sent to the cloud. */
const newerThan = (local: Song, cloud?: RemoteSong) => !cloud || at(local) > at(cloud.song);
const survivor = (cloud?: RemoteSong) => (cloud?.deleted ? undefined : cloud?.song);

const sameAs = (local: Song, cloud?: RemoteSong) => !!cloud && !cloud.deleted && at(local) === at(cloud.song);

function resolve(local: Song | undefined, cloud: RemoteSong | undefined): { keep?: Song; push?: Song } {
  if (local && newerThan(local, cloud)) return { keep: local, push: local };
  if (local && sameAs(local, cloud)) return { keep: local };
  return { keep: survivor(cloud) };
}

export function mergeSongs(local: Song[], cloud: RemoteSong[], deletedHere: Set<string>): MergeResult {
  const remoteById = new Map(cloud.map((r) => [r.song.id, r]));
  const ids = [...new Set([...local.map((s) => s.id), ...cloud.map((r) => r.song.id)])];
  const toDelete = ids.filter((id) => deletedHere.has(id) && remoteById.get(id)?.deleted === false);
  const result = ids.filter((id) => !deletedHere.has(id)).map((id) => resolve(local.find((s) => s.id === id), remoteById.get(id)));
  return {
    songs: result.flatMap((r) => (r.keep ? [r.keep] : [])),
    toPush: result.flatMap((r) => (r.push ? [r.push] : [])),
    toDelete,
  };
}

/** Songs edited after the time they were last synced (or never synced). */
export const changedSince = (songs: Song[], syncedAt: Map<string, number>) => songs.filter((s) => at(s) > (syncedAt.get(s.id) ?? -1));

const chordKey = (c: ChordChoice) => `${c.symbol}|${toFretString(c.shape)}`;

/** Union of My chords from both sides (this device first). */
export function mergeChords(local: ChordChoice[], cloud: ChordChoice[]): ChordChoice[] {
  const seen = new Set(local.map(chordKey));
  return [...local, ...cloud.filter((c) => !seen.has(chordKey(c)))];
}
