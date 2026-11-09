/**
 * Fingering suggestions for a chord symbol: hand-picked open shapes first,
 * then movable barre shapes (E-shape rooted on the 6th string, A-shape on the 5th).
 * Used when the creator picks a chord from the library and when a key change
 * needs new positions.
 */
import { shapeFromFrets, type ChordShape } from './chordShape';
import { mod12, parseChord } from './chordSymbol';

/** Open-position shapes, low E first. Each one is checked by a test to name to its symbol. */
export const VOICING_LIBRARY: Record<string, string[]> = {
  C: ['x32010'], D: ['xx0232'], E: ['022100'], F: ['133211'], G: ['320003', '320033'], A: ['x02220'],
  Am: ['x02210'], Dm: ['xx0231'], Em: ['022000'],
  C7: ['x32310'], D7: ['xx0212'], E7: ['020100'], G7: ['320001'], A7: ['x02020'], B7: ['x21202'],
  Am7: ['x02010'], Dm7: ['xx0211'], Em7: ['020000'],
  Cmaj7: ['x32000'], Dmaj7: ['xx0222'], Fmaj7: ['xx3210'], Amaj7: ['x02120'],
  Asus2: ['x02200'], Asus4: ['x02230'], Dsus2: ['xx0230'], Dsus4: ['xx0233'], Esus4: ['022200'],
  Cadd9: ['x32030'],
};

/** Movable shapes as fret offsets from the root fret; null = muted string. */
type Pattern = (number | null)[];
const E_SHAPES: Record<string, Pattern> = {
  '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0], sus4: [0, 2, 2, 2, 0, 0], maj7: [0, null, 1, 1, 0, null],
};
const A_SHAPES: Record<string, Pattern> = {
  '': [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0],
  m7: [null, 0, 2, 0, 1, 0], maj7: [null, 0, 2, 1, 2, 0], sus2: [null, 0, 2, 2, 0, 0], sus4: [null, 0, 2, 2, 3, 0],
  dim: [null, 0, 1, 2, 1, null],
};
const E_STRING_CHROMA = 4;
const A_STRING_CHROMA = 9;

export interface Voicing {
  frets: string;
  shape: ChordShape;
  label: string;
}

const toVoicing = (frets: string, label: string): Voicing => ({ frets, shape: shapeFromFrets(frets), label });

function movable(pattern: Pattern | undefined, rootChroma: number, stringChroma: number, label: string): Voicing[] {
  if (!pattern) return [];
  // Fret 0 would be the open shape; play it at the 12th fret instead.
  const rootFret = mod12(rootChroma - stringChroma) || 12;
  const parts = pattern.map((p) => (p === null ? 'x' : String(p + rootFret)));
  const frets = parts.some((p) => p.length > 1) ? parts.join('-') : parts.join('');
  return [toVoicing(frets, label)];
}

function openVoicings(rootChroma: number, type: string): Voicing[] {
  return Object.entries(VOICING_LIBRARY)
    .filter(([symbol]) => {
      const c = parseChord(symbol);
      return c && c.rootChroma === rootChroma && c.type === type && !c.bass;
    })
    .flatMap(([, list]) => list.map((f) => toVoicing(f, 'open')));
}

const lowestFret = (v: Voicing) => Math.min(...v.shape.dots.map((d) => d.fret));

export function suggestVoicings(symbol: string): Voicing[] {
  const c = parseChord(symbol);
  if (!c || c.bass) return [];
  const barres = [
    ...movable(E_SHAPES[c.type], c.rootChroma, E_STRING_CHROMA, 'E-shape barre'),
    ...movable(A_SHAPES[c.type], c.rootChroma, A_STRING_CHROMA, 'A-shape barre'),
  ].sort((a, b) => lowestFret(a) - lowestFret(b));
  const all = [...openVoicings(c.rootChroma, c.type), ...barres];
  return all.filter((v, i) => all.findIndex((o) => o.frets === v.frets) === i);
}
