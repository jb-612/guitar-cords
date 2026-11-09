import { nameChord, nameNotes } from './chordNaming';
import { shapeFromFrets } from './chordShape';

const symbols = (frets: string, key?: string) => nameChord(shapeFromFrets(frets), key).map((n) => n.symbol);

describe('nameChord', () => {
  it.each([
    ['x32010', 'C'],
    ['320003', 'G'],
    ['xx0232', 'D'],
    ['x02210', 'Am'],
    ['022000', 'Em'],
    ['x02020', 'A7'],
    ['133211', 'F'],
    ['x35553', 'C'],
    ['x00211', 'Dm7/A'],
  ])('names %s as %s first', (frets, expected) => {
    expect(symbols(frets)[0]).toBe(expected);
  });

  it('prefers the slash chord over an exotic root-position name (032010 -> C/E)', () => {
    expect(symbols('032010')[0]).toBe('C/E');
  });

  it('offers alternative names for the same notes (x32253 -> C6, also Am7/C)', () => {
    const names = symbols('x32253');
    expect(names[0]).toBe('C6');
    expect(names).toContain('Am7/C');
  });

  it('ranks non-diatonic candidates below diatonic ones when a key is given', () => {
    const names = nameChord(shapeFromFrets('x32253'), 'Am');
    expect(names[0]!.inKey).toBe(true);
  });

  it('spells with flats in flat keys and sharps in sharp keys', () => {
    expect(symbols('xx4322', 'B')[0]).toBe('F#');
    expect(symbols('xx4322', 'Db')[0]).toBe('Gb');
  });

  it('returns an empty list when nothing is played', () => {
    expect(nameChord(shapeFromFrets('xxxxxx'))).toEqual([]);
  });
});

describe('common flag', () => {
  it('marks everyday chord types as common and exotic ones as not', () => {
    const names = nameChord(shapeFromFrets('x32010'));
    expect(names.find((n) => n.symbol === 'C')?.common).toBe(true);
    expect(names.find((n) => n.symbol === 'Em#5/C')?.common).toBe(false);
  });
});

describe('nameNotes', () => {
  it('falls back to a chord over a foreign bass note when nothing else fits', () => {
    expect(nameNotes(['F#', 'C', 'E', 'G'])[0]?.symbol).toBe('C/F#');
    expect(nameNotes(['F', 'E', 'G', 'B'])[0]?.symbol).toBe('Em/F');
  });

  it('describes voicings without a 3rd by their intervals (the creator\'s 3x4030 -> Gmaj7(add13, no3))', () => {
    expect(nameChord(shapeFromFrets('3x4030'))[0]?.symbol).toBe('Gmaj7(add13, no3)');
  });

  it('keeps recognised no-3rd chords under their usual name (G C D F A -> G11)', () => {
    expect(nameNotes(['G', 'C', 'D', 'F', 'A'])[0]?.symbol).toBe('G11');
  });

  it('returns nothing for note sets with no chord at all', () => {
    expect(nameNotes(['F', 'B'])).toEqual([]);
  });

  it('names a power chord', () => {
    expect(nameNotes(['E', 'B'])[0]?.symbol).toBe('E5');
  });
});
