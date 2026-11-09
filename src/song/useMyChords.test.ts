import { rememberChord } from './useMyChords';
import { shapeFromFrets } from '../music/chordShape';

describe('rememberChord', () => {
  it('adds newest first and does not duplicate the same name + frets', () => {
    const a = { symbol: 'Mine', shape: shapeFromFrets('3x4030') };
    const b = { symbol: 'C', shape: shapeFromFrets('x32010') };
    expect(rememberChord(rememberChord(rememberChord([], a), b), a).map((c) => c.symbol)).toEqual(['Mine', 'C']);
  });

  it('keeps the same name with a different fingering as a separate chord', () => {
    const a = { symbol: 'G', shape: shapeFromFrets('320003') };
    const b = { symbol: 'G', shape: shapeFromFrets('320033') };
    expect(rememberChord(rememberChord([], a), b)).toHaveLength(2);
  });
});
