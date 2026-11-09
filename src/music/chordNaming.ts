/**
 * Name a chord from what is played. Tonal's Chord.detect finds the candidates;
 * this module ranks them the way a guitarist would read a chord chart:
 * common chord types first, root position before slash chords, and
 * (when the song key is known) diatonic names first, spelled for that key.
 */
import { Chord, Note } from '@tonaljs/tonal';
import { soundingMidi, type ChordShape } from './chordShape';
import { formatChord, keyChromas, mod12, parseChord, parseKey, spell, spellingForKey } from './chordSymbol';

export interface ChordName {
  symbol: string;
  root: string;
  type: string;
  bass?: string;
  /** All chord tones belong to the given key (false when no key was given). */
  inKey: boolean;
  /** An everyday chord-chart type (not e.g. "m#5"). */
  common: boolean;
  /** Lower is better. */
  score: number;
}

/** Chord types ordered from most to least common on chord charts. */
const COMMON_TYPES = [
  '', 'm', '7', 'm7', 'maj7', '5', 'sus4', 'sus2', '6', 'm6', 'add9', '9', 'dim', 'dim7',
  'm7b5', 'aug', '7sus4', 'madd9', 'm9', 'maj9', '11', '13', 'mMaj7',
];
const UNCOMMON_PENALTY = 20;
const SLASH_PENALTY = 6;
/** Fallback names rank below anything Tonal recognises. */
const FALLBACK_SCORE = 40;
const OUT_OF_KEY_PENALTY = 10;

function typeRank(type: string): number {
  const i = COMMON_TYPES.indexOf(type);
  return i === -1 ? UNCOMMON_PENALTY : i;
}

function isInKey(root: string, type: string, key?: string): boolean {
  const k = key ? parseKey(key) : null;
  if (!k) return false;
  const scale = keyChromas(k);
  return Chord.get(`${root}${type}`).notes.every((n) => scale.has(Note.chroma(n)!));
}

function toCandidate(detected: string, key?: string): ChordName | null {
  const parsed = parseChord(detected);
  if (!parsed) return null;
  const { root, type, bass } = parsed;
  const inKey = isInKey(root, type, key);
  const score = typeRank(type) + (bass ? SLASH_PENALTY : 0) + (key && !inKey ? OUT_OF_KEY_PENALTY : 0);
  return { symbol: formatChord(root, type, bass), root, type, bass, inKey, common: COMMON_TYPES.includes(type), score };
}

const rank = (detected: string[], key?: string) =>
  detected
    .map((d) => toCandidate(d, key))
    .filter((c): c is ChordName => c !== null)
    .sort((a, b) => a.score - b.score);

/** A recognised chord sitting on a bass note that is not part of it, e.g. C/F#. */
function overForeignBass(notes: string[], key?: string): ChordName[] {
  const [bass, ...upper] = notes;
  if (!bass || upper.length < 3) return [];
  return rank(Chord.detect(upper), key)
    .filter((c) => !c.bass)
    .map((c) => ({ ...c, symbol: `${c.symbol}/${bass}`, bass, score: c.score + SLASH_PENALTY }));
}

/**
 * Rank names for pitch classes given bass first (e.g. ['E', 'C', 'G']).
 * Fallbacks, in order: Tonal's names, a chord over a foreign bass, then a
 * description built from the intervals above the bass (e.g. "Gmaj7(add13, no3)").
 */
export function nameNotes(notes: string[], key?: string): ChordName[] {
  const direct = rank(Chord.detect(notes), key);
  if (direct.length > 0) return direct;
  const slash = overForeignBass(notes, key);
  if (slash.length > 0) return slash;
  const described = describeFromBass(notes);
  return described ? [described] : [];
}

const EXTENSIONS: Record<number, string> = { 1: 'b9', 2: '9', 3: '#9', 5: '11', 6: '#11', 8: 'b13', 9: '13' };

const thirdOf = (iv: Set<number>) => (iv.has(4) ? '' : iv.has(3) ? 'm' : null);

function susOf(iv: Set<number>, third: string | null): string {
  if (third !== null) return '';
  if (iv.has(5)) return 'sus4';
  return iv.has(2) ? 'sus2' : '';
}

function seventhOf(iv: Set<number>, third: string | null): string {
  if (iv.has(11)) return third === 'm' ? 'Maj7' : 'maj7';
  if (iv.has(10)) return '7';
  return iv.has(9) ? '6' : '';
}

/** Semitones each part of the name already accounts for. */
function consumed(third: string | null, sus: string, seventh: string): Set<number> {
  const parts: Record<string, number[]> = { '': [4], m: [3], sus4: [5], sus2: [2], maj7: [11], Maj7: [11], '7': [10], '6': [9] };
  return new Set([7, ...(third === null ? [] : parts[third]!), ...(parts[sus] ?? []), ...(seventh ? parts[seventh]! : [])]);
}

/** Name built from intervals above the bass. Needs 3+ distinct notes. */
function describeFromBass(notes: string[]): ChordName | null {
  const root = notes[0];
  if (!root || notes.length < 3) return null;
  const type = describeIntervals(new Set(notes.slice(1).map((n) => mod12(Note.chroma(n)! - Note.chroma(root)!))));
  return { symbol: `${root}${type}`, root, type, inKey: false, common: false, score: FALLBACK_SCORE };
}

/** Chord-type text for semitone intervals above the root, e.g. {7, 9, 11} -> "maj7(add13, no3)". */
function describeIntervals(iv: Set<number>): string {
  const third = thirdOf(iv);
  const sus = susOf(iv, third);
  const seventh = seventhOf(iv, third);
  const used = consumed(third, sus, seventh);
  const adds = [...iv].filter((s) => !used.has(s) && EXTENSIONS[s]).sort((a, b) => a - b).map((s) => `add${EXTENSIONS[s]}`);
  const extras = third === null && !sus ? [...adds, 'no3'] : adds;
  return `${third ?? ''}${seventh}${sus}${parenthesized(extras)}`;
}

const parenthesized = (parts: string[]) => (parts.length ? `(${parts.join(', ')})` : '');

/** Rank names for a fretboard shape, spelled for the song key when given, in the given tuning. */
export function nameChord(shape: ChordShape, key?: string, tuning?: readonly number[]): ChordName[] {
  const midi = soundingMidi(shape, tuning).filter((m): m is number => m !== null);
  if (midi.length === 0) return [];
  const spelling = spellingForKey(key);
  const bassFirst = [...midi].sort((a, b) => a - b).map((m) => spell(m, spelling));
  return nameNotes([...new Set(bassFirst)], key);
}
