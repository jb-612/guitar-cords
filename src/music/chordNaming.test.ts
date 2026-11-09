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

describe('nameNotes', () => {
  it('names a power chord', () => {
    expect(nameNotes(['E', 'B'])[0]?.symbol).toBe('E5');
  });
});
