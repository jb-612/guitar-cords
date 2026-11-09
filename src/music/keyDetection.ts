/**
 * Suggest a song key from its chord sequence by scoring all 24 major/minor keys:
 * diatonic chords score, out-of-key roots cost, and a tonic chord at the start
 * or end of the sequence (where songs usually begin and resolve) earns a bonus.
 */
import { formatKey, mod12, parseChord, type KeyRef, type Mode } from './chordSymbol';

export interface KeySuggestion extends KeyRef {
  name: string;
  score: number;
  /** 0..1, how well the best-fitting interpretation explains the sequence. */
  confidence: number;
}

type Quality = 'maj' | 'min' | 'dim';

/** Diatonic chords per key as "semitones above tonic:quality". Minor includes harmonic V and vii°. */
const DIATONIC: Record<Mode, Set<string>> = {
  major: new Set(['0:maj', '2:min', '4:min', '5:maj', '7:maj', '9:min', '11:dim']),
  minor: new Set(['0:min', '2:dim', '3:maj', '5:min', '7:min', '7:maj', '8:maj', '10:maj', '11:dim']),
};
const SCALE_STEPS: Record<Mode, Set<number>> = {
  major: new Set([0, 2, 4, 5, 7, 9, 11]),
  minor: new Set([0, 2, 3, 5, 7, 8, 10, 11]),
};
const MAJOR_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
const FIRST_TONIC_BONUS = 1;
const LAST_TONIC_BONUS = 1.5;

function quality(type: string): Quality {
  if (type.startsWith('dim') || type === 'm7b5') return 'dim';
  return type.startsWith('m') && !type.startsWith('maj') ? 'min' : 'maj';
}

interface Degree {
  chroma: number;
  quality: Quality;
}

function chordScore(c: Degree, tonic: number, mode: Mode): number {
  const step = mod12(c.chroma - tonic);
  if (DIATONIC[mode].has(`${step}:${c.quality}`)) return 1;
  return SCALE_STEPS[mode].has(step) ? 0.25 : -0.5;
}

function isTonic(c: Degree | undefined, tonic: number, mode: Mode): boolean {
  return !!c && c.chroma === tonic && c.quality === (mode === 'major' ? 'maj' : 'min');
}

function scoreKey(chords: Degree[], tonic: number, mode: Mode): number {
  const fit = chords.reduce((sum, c) => sum + chordScore(c, tonic, mode), 0);
  const first = isTonic(chords[0], tonic, mode) ? FIRST_TONIC_BONUS : 0;
  const last = isTonic(chords[chords.length - 1], tonic, mode) ? LAST_TONIC_BONUS : 0;
  return fit + first + last;
}

export function suggestKeys(symbols: string[]): KeySuggestion[] {
  const chords = symbols
    .map(parseChord)
    .filter((c) => c !== null)
    .map((c) => ({ chroma: c.rootChroma, quality: quality(c.type) }));
  if (chords.length === 0) return [];
  const maxScore = chords.length + FIRST_TONIC_BONUS + LAST_TONIC_BONUS;
  const keys = (['major', 'minor'] as const).flatMap((mode) =>
    Array.from({ length: 12 }, (_, tonic) => {
      const ref = { tonic: (mode === 'major' ? MAJOR_NAMES : MINOR_NAMES)[tonic]!, mode };
      const score = scoreKey(chords, tonic, mode);
      return { ...ref, name: formatKey(ref), score, confidence: Math.max(0, Math.min(1, score / maxScore)) };
    }),
  );
  return keys.sort((a, b) => b.score - a.score);
}
