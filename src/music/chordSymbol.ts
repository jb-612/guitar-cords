/**
 * Chord-symbol parsing and note spelling shared by naming, key detection and transposition.
 * Symbols use the app's display form: "C", "Am7", "G/B", "F#m7b5" (major has no suffix).
 */
import { Chord, Key, Note } from '@tonaljs/tonal';

export type Spelling = 'sharps' | 'flats' | 'neutral';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** Most common names guitarists use when no key says otherwise. */
const NEUTRAL = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const TABLES: Record<Spelling, string[]> = { sharps: SHARPS, flats: FLATS, neutral: NEUTRAL };

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

export function spell(chroma: number, spelling: Spelling = 'neutral'): string {
  return TABLES[spelling][mod12(chroma)]!;
}

export interface ParsedChord {
  root: string;
  /** Tonal-compatible type suffix in display form ('' = major). */
  type: string;
  bass?: string;
  rootChroma: number;
  bassChroma?: number;
}

const SYMBOL_RE = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/;

/** Tonal writes some types differently from common chord-chart usage. */
const TYPE_ALIASES: Record<string, string> = { M: '', maj: '', o: 'dim', o7: 'dim7', ø: 'm7b5', Maj7: 'maj7', M7: 'maj7' };

/** Map Tonal's names to chart names: "M" -> "", "Madd9" -> "add9", "7no5" -> "7" (an omitted 5th isn't written). */
export function normalizeType(type: string): string {
  const t = type.replace(/no5$/, '').replace(/^Madd/, 'add');
  return TYPE_ALIASES[t] ?? t;
}

export function parseChord(symbol: string): ParsedChord | null {
  const m = SYMBOL_RE.exec(symbol.trim());
  if (!m) return null;
  const [, root, rawType = '', bass] = m;
  const type = normalizeType(rawType);
  if (Chord.get(`${root}${type}`).empty) return null;
  return {
    root: root!,
    type,
    bass,
    rootChroma: Note.chroma(root!)!,
    bassChroma: bass ? Note.chroma(bass) : undefined,
  };
}

export function formatChord(root: string, type: string, bass?: string): string {
  return bass && bass !== root ? `${root}${type}/${bass}` : `${root}${type}`;
}

export type Mode = 'major' | 'minor';

export interface KeyRef {
  tonic: string;
  mode: Mode;
}

/** Parse a key written as "G", "F#m", "Bb", "Ebm". */
export function parseKey(key: string): KeyRef | null {
  const m = /^([A-G](?:#|b)?)(m?)$/.exec(key.trim());
  return m ? { tonic: m[1]!, mode: m[2] ? 'minor' : 'major' } : null;
}

export const formatKey = (k: KeyRef) => `${k.tonic}${k.mode === 'minor' ? 'm' : ''}`;

/** Spelling implied by a key signature; keys with no accidentals use common guitar names. */
const keySignature = (k: KeyRef) =>
  k.mode === 'major' ? Key.majorKey(k.tonic).keySignature : Key.minorKey(k.tonic).keySignature;

export function spellingForKey(key?: string): Spelling {
  const k = key ? parseKey(key) : null;
  const sig = k ? keySignature(k) : '';
  if (sig.includes('b')) return 'flats';
  return sig.includes('#') ? 'sharps' : 'neutral';
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
// Natural minor plus the raised 7th from harmonic minor (V and vii° are common in minor songs).
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10, 11];

/** Pitch classes (chroma) that belong to a key. */
export function keyChromas(k: KeyRef): Set<number> {
  const tonic = Note.chroma(k.tonic)!;
  return new Set((k.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS).map((s) => mod12(tonic + s)));
}
