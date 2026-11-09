/**
 * Guitar tunings (MIDI pitches of the open strings, low E string first).
 * Chord naming, playback, tab/score and MusicXML all use the song's tuning;
 * the built-in voicing library is for standard tuning.
 */
import { Note } from '@tonaljs/tonal';
import { STANDARD_TUNING } from './chordShape';

export interface Tuning {
  id: string;
  name: string;
  notes: number[];
}

export const TUNINGS: Tuning[] = [
  { id: 'standard', name: 'Standard (EADGBE)', notes: [...STANDARD_TUNING] },
  { id: 'drop-d', name: 'Drop D (DADGBE)', notes: [38, 45, 50, 55, 59, 64] },
  { id: 'half-down', name: 'Half-step down (E♭)', notes: [39, 44, 49, 54, 58, 63] },
  { id: 'dadgad', name: 'DADGAD', notes: [38, 45, 50, 55, 57, 62] },
  { id: 'open-g', name: 'Open G (DGDGBD)', notes: [38, 43, 50, 55, 59, 62] },
  { id: 'open-d', name: 'Open D (DADF♯AD)', notes: [38, 45, 50, 54, 57, 62] },
];

export const tuningById = (id: string) => TUNINGS.find((t) => t.id === id) ?? TUNINGS[0]!;

const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

export const tuningIdOf = (notes?: readonly number[]) => (notes ? (TUNINGS.find((t) => same(t.notes, notes))?.id ?? 'standard') : 'standard');

export const isStandard = (notes?: readonly number[]) => !notes || same(notes, STANDARD_TUNING);

/** alphaTex staff tuning, high string first: \tuning (E4 B3 G3 D3 A2 D2). */
export const tuningTex = (notes: readonly number[]) => `\\tuning (${[...notes].reverse().map((m) => Note.fromMidiSharps(m)).join(' ')})`;
