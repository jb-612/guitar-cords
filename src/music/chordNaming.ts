/**
 * Name a chord from what is played. Tonal's Chord.detect finds the candidates;
 * this module ranks them the way a guitarist would read a chord chart:
 * common chord types first, root position before slash chords, and
 * (when the song key is known) diatonic names first, spelled for that key.
 */
import { Chord, Note } from '@tonaljs/tonal';
import { soundingMidi, type ChordShape } from './chordShape';
import { formatChord, keyChromas, parseChord, parseKey, spell, spellingForKey } from './chordSymbol';

export interface ChordName {
  symbol: string;
  root: string;
  type: string;
  bass?: string;
  /** All chord tones belong to the given key (false when no key was given). */
  inKey: boolean;
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
  return { symbol: formatChord(root, type, bass), root, type, bass, inKey, score };
}

/** Rank names for pitch classes given bass first (e.g. ['E', 'C', 'G']). */
export function nameNotes(notes: string[], key?: string): ChordName[] {
  return Chord.detect(notes)
    .map((d) => toCandidate(d, key))
    .filter((c): c is ChordName => c !== null)
    .sort((a, b) => a.score - b.score);
}

/** Rank names for a fretboard shape, spelled for the song key when given. */
export function nameChord(shape: ChordShape, key?: string): ChordName[] {
  const midi = soundingMidi(shape).filter((m): m is number => m !== null);
  if (midi.length === 0) return [];
  const spelling = spellingForKey(key);
  const bassFirst = [...midi].sort((a, b) => a - b).map((m) => spell(m, spelling));
  return nameNotes([...new Set(bassFirst)], key);
}
