/**
 * Fingering suggestions for a chord symbol: hand-picked open shapes first,
 * then movable barre shapes (E-shape rooted on the 6th string, A-shape on the 5th).
 * Used when the creator picks a chord from the library and when a key change
 * needs new positions.
 */
import { shapeFromFrets, type ChordShape } from './chordShape';
import { mod12, parseChord, type ParsedChord } from './chordSymbol';

/** Open-position shapes, low E first. Each one is checked by a test to name to its symbol. */
export const VOICING_LIBRARY: Record<string, string[]> = {
  C: ['x32010'], D: ['xx0232'], E: ['022100'], F: ['133211'], G: ['320003', '320033'], A: ['x02220'],
  Am: ['x02210'], Dm: ['xx0231'], Em: ['022000'], Fm: ['133111'], Bm: ['x24432'],
  C7: ['x32310'], D7: ['xx0212'], E7: ['020100'], F7: ['131211'], G7: ['320001'], A7: ['x02020'], B7: ['x21202'],
  Am7: ['x02010'], Dm7: ['xx0211'], Em7: ['020000'], Bm7: ['x20202'],
  Cmaj7: ['x32000'], Dmaj7: ['xx0222'], Emaj7: ['021100'], Fmaj7: ['xx3210'], Gmaj7: ['320002'], Amaj7: ['x02120'],
  D6: ['xx0202'], G6: ['320000'], A6: ['x02222'], Am6: ['x02212'],
  Asus2: ['x02200'], Asus4: ['x02230'], Dsus2: ['xx0230'], Dsus4: ['xx0233'], Esus4: ['022200'], Gsus4: ['330013'],
  E7sus4: ['020200'],
  Cadd9: ['x32030'],
  'C/E': ['032010'], 'C/G': ['332010'], 'D/F#': ['200232'], 'G/B': ['x20003'], 'F/C': ['x33211'],
};

/** Movable shapes as fret offsets from the root fret; null = muted string. */
type Pattern = (number | null)[];
const E_SHAPES: Record<string, Pattern> = {
  '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0], sus4: [0, 2, 2, 2, 0, 0], maj7: [0, null, 1, 1, 0, null],
  '7sus4': [0, 2, 0, 2, 0, 0], '6': [0, 2, 2, 1, 2, 0],
};
const A_SHAPES: Record<string, Pattern> = {
  '': [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0],
  m7: [null, 0, 2, 0, 1, 0], maj7: [null, 0, 2, 1, 2, 0], sus2: [null, 0, 2, 2, 0, 0], sus4: [null, 0, 2, 2, 3, 0],
  dim: [null, 0, 1, 2, 1, null], '6': [null, 0, 2, 2, 2, 2], m6: [null, 0, 2, 2, 1, 2],
  '9': [null, 0, -1, 0, 0, null], m7b5: [null, 0, 1, 0, 1, null],
};
/** Root on the D string (shapes like the open D family, moved up the neck). */
const D_SHAPES: Record<string, Pattern> = {
  '': [null, null, 0, 2, 3, 2], m: [null, null, 0, 2, 3, 1], '7': [null, null, 0, 2, 1, 2],
  dim7: [null, null, 0, 1, 0, 1], aug: [null, null, 0, 3, 3, 2],
};
const E_STRING_CHROMA = 4;
const A_STRING_CHROMA = 9;
const D_STRING_CHROMA = 2;

export interface Voicing {
  frets: string;
  shape: ChordShape;
  label: string;
}

const toVoicing = (frets: string, label: string): Voicing => ({ frets, shape: shapeFromFrets(frets), label });

/** Root fret so every fretted note is at fret 1 or higher (an octave up if needed). */
function rootFretFor(pattern: Pattern, rootChroma: number, stringChroma: number): number {
  const fret = mod12(rootChroma - stringChroma) || 12;
  const lowest = Math.min(...pattern.filter((p): p is number => p !== null));
  return fret + lowest < 1 ? fret + 12 : fret;
}

function movable(pattern: Pattern | undefined, rootChroma: number, stringChroma: number, label: string): Voicing[] {
  if (!pattern) return [];
  const rootFret = rootFretFor(pattern, rootChroma, stringChroma);
  const parts = pattern.map((p) => (p === null ? 'x' : String(p + rootFret)));
  const frets = parts.some((p) => p.length > 1) ? parts.join('-') : parts.join('');
  return [toVoicing(frets, label)];
}

const sameChord = (a: ParsedChord, b: ParsedChord) => a.rootChroma === b.rootChroma && a.type === b.type && a.bassChroma === b.bassChroma;

function openVoicings(wanted: ParsedChord): Voicing[] {
  return Object.entries(VOICING_LIBRARY)
    .filter(([symbol]) => {
      const c = parseChord(symbol);
      return c !== null && sameChord(c, wanted);
    })
    .flatMap(([, list]) => list.map((f) => toVoicing(f, 'open')));
}

const lowestFret = (v: Voicing) => Math.min(...v.shape.dots.map((d) => d.fret));

/** Movable shapes only fit chords without a separate bass note. */
const movables = (c: ParsedChord): Voicing[] =>
  c.bass
    ? []
    : [
        ...movable(E_SHAPES[c.type], c.rootChroma, E_STRING_CHROMA, 'E-shape barre'),
        ...movable(A_SHAPES[c.type], c.rootChroma, A_STRING_CHROMA, 'A-shape barre'),
        ...movable(D_SHAPES[c.type], c.rootChroma, D_STRING_CHROMA, 'D-shape'),
      ].sort((a, b) => lowestFret(a) - lowestFret(b));

export function suggestVoicings(symbol: string): Voicing[] {
  const c = parseChord(symbol);
  if (!c) return [];
  const all = [...openVoicings(c), ...movables(c)];
  return all.filter((v, i) => all.findIndex((o) => o.frets === v.frets) === i);
}
