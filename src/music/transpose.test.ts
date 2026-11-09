import { transposeChord, changeKey, capoFor } from './transpose';
import type { Spelling } from './chordSymbol';

describe('transposeChord', () => {
  it.each([
    ['C', 2, 'sharps', 'D'],
    ['Am7', 3, 'sharps', 'Cm7'],
    ['G/B', 1, 'flats', 'Ab/C'],
    ['F#m', -1, 'sharps', 'Fm'],
    ['E', 1, 'flats', 'F'],
    ['B7', 1, 'sharps', 'C7'],
    ['Dsus4', -2, 'sharps', 'Csus4'],
  ])('%s by %i semitones (%s) -> %s', (chord, semis, flats, expected) => {
    expect(transposeChord(chord, semis, flats as Spelling)).toBe(expected);
  });
});

describe('changeKey', () => {
  it('moves a progression from G to E, spelled for E major', () => {
    expect(changeKey(['G', 'Em', 'C', 'D'], 'G', 'E')).toEqual(['E', 'C#m', 'A', 'B']);
  });

  it('moves a progression from C to F, spelled with flats', () => {
    expect(changeKey(['C', 'F', 'G7'], 'C', 'F')).toEqual(['F', 'Bb', 'C7']);
  });

  it('keeps minor keys minor (Am -> Dm)', () => {
    expect(changeKey(['Am', 'Dm', 'E7'], 'Am', 'Dm')).toEqual(['Dm', 'Gm', 'A7']);
  });
});

describe('capoFor', () => {
  it('suggests playing open G shapes with capo 2 for A major', () => {
    expect(capoFor('A')).toEqual(expect.arrayContaining([{ capo: 2, shapesKey: 'G' }]));
  });

  it('suggests capo 0 when the key is already guitar-friendly', () => {
    expect(capoFor('G')[0]).toEqual({ capo: 0, shapesKey: 'G' });
  });
});
