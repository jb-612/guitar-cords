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

describe('the bigger voicing library', () => {
  it.each(['C7', 'Cm', 'Cm7', 'F#7', 'Bbmaj7', 'Ebm6', 'Ab6', 'Ebdim7', 'Daug', 'C9', 'Bm7b5', 'E7sus4', 'G6', 'Emaj7', 'Am6', 'D/F#', 'C/G', 'G/B', 'F/C', 'Gsus4'])(
    'has playable fingerings for %s, named as such',
    (symbol) => {
      const v = suggestVoicings(symbol);
      expect(v.length).toBeGreaterThan(0);
      for (const s of v) expect(nameChord(shapeFromFrets(s.frets)).map((n) => n.symbol)).toContain(symbol);
    },
  );
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

  it('has a movable shape for every diatonic triad type, including diminished (F#dim)', () => {
    const v = suggestVoicings('F#dim');
    expect(v.length).toBeGreaterThan(0);
    for (const s of v) expect(nameChord(shapeFromFrets(s.frets)).map((n) => n.symbol)).toContain('F#dim');
  });

  it('handles enharmonic roots (A#m -> same shapes as Bbm)', () => {
    expect(suggestVoicings('A#m').map((v) => v.frets)).toEqual(suggestVoicings('Bbm').map((v) => v.frets));
  });

  it('assigns fingers to every fretted string', () => {
    const [v] = suggestVoicings('F');
    expect(v!.shape.dots.every((d) => d.finger >= 1)).toBe(true);
  });

  it('returns nothing for unknown symbols or slash chords it has no shape for', () => {
    expect(suggestVoicings('Bb/Ab')).toEqual([]);
    expect(suggestVoicings('not-a-chord')).toEqual([]);
  });
});
