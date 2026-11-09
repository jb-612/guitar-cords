/**
 * The seven chords that belong to a key (triads), spelled for that key.
 * Minor keys use the harmonic-minor V (E in A minor), as most songs do.
 */
import { Note } from '@tonaljs/tonal';
import { parseKey, spell, spellingForKey } from './chordSymbol';

const DEGREES = {
  major: { steps: [0, 2, 4, 5, 7, 9, 11], types: ['', 'm', 'm', '', '', 'm', 'dim'] },
  minor: { steps: [0, 2, 3, 5, 7, 8, 10], types: ['m', 'dim', '', 'm', '', '', ''] },
} as const;

export function diatonicChords(key: string): string[] {
  const k = parseKey(key);
  if (!k) return [];
  const tonic = Note.chroma(k.tonic)!;
  const { steps, types } = DEGREES[k.mode];
  const spelling = spellingForKey(key);
  return steps.map((step, i) => `${spell(tonic + step, spelling)}${types[i]}`);
}
