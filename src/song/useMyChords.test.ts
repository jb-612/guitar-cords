import { renderHook } from '@testing-library/react';
import { rememberChord, useMyChords } from './useMyChords';
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

describe('loading stored chords', () => {
  it('repairs fingerings saved with the same string twice', () => {
    const dot = (string: number, fret: number) => ({ string, fret, finger: 1 });
    localStorage.setItem('guitar-cords:my-chords', JSON.stringify([{ symbol: 'X', shape: { dots: [dot(4, 2), dot(4, 2), dot(5, 2)], muted: [] } }]));
    const { result } = renderHook(() => useMyChords());
    expect(result.current.myChords[0]!.shape.dots.map((d) => d.string)).toEqual([4, 5]);
  });
});
