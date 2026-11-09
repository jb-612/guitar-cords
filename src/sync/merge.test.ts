import { changedSince, mergeChords, mergeSongs, type RemoteSong } from './merge';
import { createSong, type Song } from '../song/song';
import { shapeFromFrets } from '../music/chordShape';

const song = (id: string, title: string, updatedAt: number): Song => ({ ...createSong({ title }), id, updatedAt });
const remote = (s: Song, deleted = false): RemoteSong => ({ song: s, deleted });

describe('mergeSongs', () => {
  it('keeps songs that exist on one side only', () => {
    const r = mergeSongs([song('a', 'A', 1)], [remote(song('b', 'B', 1))], new Set());
    expect(r.songs.map((s) => s.id).sort()).toEqual(['a', 'b']);
    expect(r.toPush.map((s) => s.id)).toEqual(['a']);
  });

  it('the newer edit wins', () => {
    const r = mergeSongs([song('a', 'Local', 5)], [remote(song('a', 'Cloud', 9))], new Set());
    expect(r.songs[0]!.title).toBe('Cloud');
    expect(r.toPush).toEqual([]);
    const r2 = mergeSongs([song('a', 'Local', 9)], [remote(song('a', 'Cloud', 5))], new Set());
    expect(r2.songs[0]!.title).toBe('Local');
    expect(r2.toPush.map((s) => s.title)).toEqual(['Local']);
  });

  it('an echo of our own upload (same time) keeps the local copy untouched and pushes nothing', () => {
    const local = song('a', 'Same', 7);
    const r = mergeSongs([local], [remote({ ...local, title: 'Same' })], new Set());
    expect(r.songs[0]).toBe(local);
    expect(r.toPush).toEqual([]);
  });

  it('a song deleted in the cloud is removed here unless edited after the delete', () => {
    const gone = mergeSongs([song('a', 'A', 5)], [remote(song('a', 'A', 9), true)], new Set());
    expect(gone.songs).toEqual([]);
    const revived = mergeSongs([song('a', 'A', 12)], [remote(song('a', 'A', 9), true)], new Set());
    expect(revived.songs).toHaveLength(1);
    expect(revived.toPush).toHaveLength(1);
  });

  it('a song deleted here is deleted in the cloud', () => {
    const r = mergeSongs([], [remote(song('a', 'A', 5))], new Set(['a']));
    expect(r.songs).toEqual([]);
    expect(r.toDelete).toEqual(['a']);
  });
});

describe('changedSince', () => {
  it('lists songs edited after their last sync', () => {
    const songs = [song('a', 'A', 5), song('b', 'B', 9), song('c', 'C', 3)];
    expect(changedSince(songs, new Map([['a', 5], ['b', 7]])).map((s) => s.id)).toEqual(['b', 'c']);
  });
});

describe('mergeChords', () => {
  it('unions My chords by name + fingering', () => {
    const g = { symbol: 'G', shape: shapeFromFrets('320003') };
    const g2 = { symbol: 'G', shape: shapeFromFrets('320033') };
    const mine = { symbol: 'Mine', shape: shapeFromFrets('3x4030') };
    expect(mergeChords([g, mine], [g, g2]).map((c) => c.symbol)).toEqual(['G', 'Mine', 'G']);
  });
});
