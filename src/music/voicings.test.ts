import { suggestVoicings, VOICING_LIBRARY } from './voicings';
import { nameChord } from './chordNaming';
import { shapeFromFrets } from './chordShape';

describe('VOICING_LIBRARY', () => {
  it.each(Object.entries(VOICING_LIBRARY))('every shape stored for %s actually names to it', (symbol, frets) => {
    for (const f of frets) {
      const names = nameChord(shapeFromFrets(f)).map((n) => n.symbol);
      expect(names, `${f} should be ${symbol}`).toContain(symbol);
    }
  });
});

describe('suggestVoicings', () => {
  it('puts the open shape first for an open chord', () => {
    const v = suggestVoicings('G');
    expect(v[0]?.frets).toBe('320003');
  });

  it('builds a movable barre shape for a chord without an open shape (Bbm)', () => {
    const v = suggestVoicings('Bbm');
    expect(v.length).toBeGreaterThan(0);
    for (const s of v) expect(nameChord(shapeFromFrets(s.frets)).map((n) => n.symbol)).toContain('Bbm');
  });

  it('handles enharmonic roots (A#m -> same shapes as Bbm)', () => {
    expect(suggestVoicings('A#m').map((v) => v.frets)).toEqual(suggestVoicings('Bbm').map((v) => v.frets));
  });

  it('assigns fingers to every fretted string', () => {
    const [v] = suggestVoicings('F');
    expect(v!.shape.dots.every((d) => d.finger >= 1)).toBe(true);
  });

  it('returns nothing for unknown symbols', () => {
    expect(suggestVoicings('not-a-chord')).toEqual([]);
  });
});
