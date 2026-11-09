import { applyPattern, patternsFor } from './patterns';
import { addChord, createSong, type ChordHit, type Song } from './song';
import { shapeFromFrets } from '../music/chordShape';

const add = (s: Song, symbol: string, units?: number) => addChord(s, { symbol, shape: shapeFromFrets('320003') }, units);
const lane = (s: Song, bar = 0) =>
  s.bars[bar]!.events.map((e) => (e.kind === 'rest' ? `r${e.units}` : `${(e as ChordHit).symbol}${e.units}${(e as ChordHit).direction === 'up' ? '↑' : '↓'}`)).join(' ');

describe('strum patterns', () => {
  it('offers the 4/4 patterns in 4/4 and generic ones in other meters', () => {
    expect(patternsFor({ beats: 4, unit: 4 }).map((p) => p.id)).toEqual(['beats', 'eighths', 'pop', 'arpeggio']);
    expect(patternsFor({ beats: 3, unit: 4 }).map((p) => p.id)).toEqual(['beats', 'eighths', 'arpeggio']);
  });

  it('down on every beat', () => {
    expect(lane(applyPattern(add(createSong(), 'G'), 0, 'beats'))).toBe('G8↓ G8↓ G8↓ G8↓');
  });

  it('eighths alternate down and up', () => {
    expect(lane(applyPattern(add(createSong(), 'G'), 0, 'eighths'))).toBe('G4↓ G4↑ G4↓ G4↑ G4↓ G4↑ G4↓ G4↑');
  });

  it('pop: D DU UDU', () => {
    expect(lane(applyPattern(add(createSong(), 'G'), 0, 'pop'))).toBe('G8↓ G4↓ G8↑ G4↑ G4↓ G4↑');
  });

  it('keeps chord changes where they were (G for the first half, C for the second)', () => {
    const s = add(add(createSong(), 'G', 16), 'C', 16);
    expect(lane(applyPattern(s, 0, 'beats'))).toBe('G8↓ G8↓ C8↓ C8↓');
  });

  it('arpeggio: one per half bar, letting ring', () => {
    const s = applyPattern(add(createSong(), 'G'), 0, 'arpeggio');
    expect(s.bars[0]!.events.map((e) => (e as ChordHit).style)).toEqual(['arpeggio', 'arpeggio']);
  });

  it('works in 3/4 and leaves an empty bar alone', () => {
    const waltz = add(createSong({ timeSignature: { beats: 3, unit: 4 } }), 'G');
    expect(lane(applyPattern(waltz, 0, 'beats'))).toBe('G8↓ G8↓ G8↓');
    const empty = { ...createSong(), bars: [{ id: 'b', lyrics: '', events: [{ id: 'r', kind: 'rest' as const, units: 32 }] }] };
    expect(applyPattern(empty, 0, 'beats')).toBe(empty);
  });
});
