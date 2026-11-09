// @vitest-environment node
import * as at from '@coderline/alphatab';
import { soundingKey, semitonesBetween, transposeSong, withCapo, playInShapes } from './transposeSong';
import { addChord, chordSymbols, createSong, type ChordHit, type Song } from './song';
import { shapeFromFrets, toFretString } from '../music/chordShape';
import { songToAlphaTex } from '../player/alphaTex';

const add = (s: Song, symbol: string, frets: string) => addChord(s, { symbol, shape: shapeFromFrets(frets) });
const gcdEm = () => ({ ...add(add(add(add(createSong(), 'G', '320003'), 'C', 'x32010'), 'D', 'xx0232'), 'Em', '022000'), key: 'G' });
const hits = (s: Song) => s.bars.flatMap((b) => b.events).filter((e): e is ChordHit => e.kind === 'chord');

describe('transposeSong', () => {
  it('moves every chord and the key, spelled for the new key', () => {
    const s = transposeSong(gcdEm(), 2);
    expect(chordSymbols(s)).toEqual(['A', 'D', 'E', 'F#m']);
    expect(s.key).toBe('A');
  });

  it('spells with flats when the new key wants them', () => {
    expect(chordSymbols(transposeSong(gcdEm(), 3))).toEqual(['Bb', 'Eb', 'F', 'Gm']);
  });

  it('gives each chord a playable fingering for its new name (open shapes when there are some)', () => {
    const s = transposeSong(gcdEm(), 2);
    expect(hits(s).map((h) => toFretString(h.shape))).toEqual(['x02220', 'xx0232', '022100', '244222']);
  });

  it('moves a custom fingering with no open strings up or down the neck', () => {
    const custom = add(createSong(), 'My barre', '133211');
    const s = transposeSong(custom, 2);
    expect(hits(s)[0]!.symbol).toBe('My barre');
    expect(toFretString(hits(s)[0]!.shape)).toBe('355433');
  });

  it('keeps the rhythm and strum settings', () => {
    const s0 = gcdEm();
    const s = transposeSong(s0, 5);
    expect(hits(s).map((h) => [h.units, h.direction, h.style])).toEqual(hits(s0).map((h) => [h.units, h.direction, h.style]));
  });

  it('is a no-op for 0 semitones', () => {
    const s = gcdEm();
    expect(transposeSong(s, 0)).toBe(s);
  });
});

describe('capo', () => {
  it('withCapo keeps the shapes and names, and the song sounds higher', () => {
    const s = withCapo(gcdEm(), 2);
    expect(chordSymbols(s)).toEqual(['G', 'C', 'D', 'Em']);
    expect(s.capo).toBe(2);
    expect(soundingKey(s)).toBe('A');
  });

  it('limits the capo to frets 0-11', () => {
    expect(withCapo(gcdEm(), -1).capo ?? 0).toBe(0);
    expect(withCapo(gcdEm(), 12).capo).toBe(11);
  });

  it('playInShapes: sound the same, but play easier shapes with a capo (A song -> G shapes, capo 2)', () => {
    const inA = transposeSong(gcdEm(), 2);
    const s = playInShapes(inA, 'G');
    expect(chordSymbols(s)).toEqual(['G', 'C', 'D', 'Em']);
    expect(s.capo).toBe(2);
    expect(soundingKey(s)).toBe('A');
  });

  it('is written to the tab so playback sounds at capo pitch', () => {
    const score = at.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(withCapo(gcdEm(), 3)));
    expect(score.tracks[0]!.staves[0]!.capo).toBe(3);
  });
});

describe('semitonesBetween', () => {
  it.each([
    ['G', 'A', 2],
    ['A', 'G', -2],
    ['C', 'F#', 6],
    ['E', 'C', -4],
    ['Am', 'Em', -5],
  ])('%s -> %s is %i (the shorter way)', (from, to, n) => {
    expect(semitonesBetween(from, to)).toBe(n);
  });
});
