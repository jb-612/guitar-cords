/**
 * Roman-numeral analysis of chords in a key (I IV V vi …), and relative major/minor keys.
 * Uppercase = major, lowercase = minor, ° = diminished, ø = half-diminished; inversions of
 * a chord over its 3rd or 5th use ⁶ and ⁶₄.
 */
import { Chord, Note } from '@tonaljs/tonal';
import { formatKey, mod12, parseChord, parseKey, spell, spellingForKey, type ParsedChord } from './chordSymbol';

const MAJOR_DEGREES = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];
const MINOR_DEGREES = ['I', '♭II', 'II', 'III', '♯III', 'IV', '♯IV', 'V', 'VI', '♯VI', 'VII', 'VII'];

type Quality = 'major' | 'minor' | 'dim' | 'half-dim';

function qualityOf(type: string): Quality {
  if (type === 'm7b5') return 'half-dim';
  if (type.startsWith('dim')) return 'dim';
  return type.startsWith('m') && !type.startsWith('maj') ? 'minor' : 'major';
}

/** What follows the numeral: the chord type without the part the numeral already says. */
function suffixOf(type: string, quality: Quality): string {
  if (quality === 'half-dim') return 'ø7';
  if (quality === 'dim') return `°${type.replace(/^dim/, '')}`;
  return quality === 'minor' ? type.replace(/^m/, '') : type;
}

const INVERSION: Record<number, string> = { 3: '⁶', 4: '⁶', 7: '⁶₄' };

/** ⁶ / ⁶₄ when the bass is the chord's 3rd / 5th, else "/Bass". */
function bassMark(c: ParsedChord): string {
  if (c.bassChroma === undefined) return '';
  const interval = mod12(c.bassChroma - c.rootChroma);
  const chordTones = Chord.get(`${c.root}${c.type}`).notes.map((n) => mod12(Note.chroma(n)! - c.rootChroma));
  return chordTones.includes(interval) && INVERSION[interval] ? INVERSION[interval]! : `/${c.bass}`;
}

export function romanNumeral(symbol: string, key: string): string | null {
  const c = parseChord(symbol);
  const k = parseKey(key);
  if (!c || !k) return null;
  const step = mod12(c.rootChroma - Note.chroma(k.tonic)!);
  const degree = (k.mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES)[step]!;
  const quality = qualityOf(c.type);
  const numeral = quality === 'major' ? degree : degree.toLowerCase();
  return `${numeral}${suffixOf(c.type, quality)}${bassMark(c)}`;
}

/** G <-> Em: the major and minor keys that share a key signature. */
export function relativeKey(key: string): string | null {
  const k = parseKey(key);
  if (!k) return null;
  const tonic = Note.chroma(k.tonic)!;
  const minor = k.mode === 'major';
  const target = mod12(tonic + (minor ? 9 : 3));
  return formatKey({ tonic: spell(target, spellingForKey(key)), mode: minor ? 'minor' : 'major' });
}
