/**
 * Transpose: shift chords by semitones. Change key: shift from one key's tonic to
 * another's and respell for the new key signature. capoFor: easy open-chord keys
 * that sound in the target key with a capo.
 */
import { Note } from '@tonaljs/tonal';
import { formatChord, parseChord, parseKey, spell, spellingForKey, type Spelling } from './chordSymbol';

/** Returns the symbol unchanged if it cannot be parsed. */
export function transposeChord(symbol: string, semitones: number, spelling: Spelling = 'neutral'): string {
  const c = parseChord(symbol);
  if (!c) return symbol;
  const root = spell(c.rootChroma + semitones, spelling);
  const bass = c.bassChroma === undefined ? undefined : spell(c.bassChroma + semitones, spelling);
  return formatChord(root, c.type, bass);
}

/** Keeps the mode of the original key (major stays major). Throws on an unknown key. */
export function changeKey(chords: string[], fromKey: string, toKey: string): string[] {
  const from = parseKey(fromKey);
  const to = parseKey(toKey);
  if (!from || !to) throw new Error(`Unknown key: ${!from ? fromKey : toKey}`);
  const semitones = Note.chroma(to.tonic)! - Note.chroma(from.tonic)!;
  return chords.map((c) => transposeChord(c, semitones, spellingForKey(toKey)));
}

const FRIENDLY_MAJOR = new Set(['C', 'G', 'D', 'A', 'E']);
const FRIENDLY_MINOR = new Set(['Am', 'Em', 'Dm']);
const MAX_CAPO = 7;

export interface CapoOption {
  capo: number;
  /** Key whose open-chord shapes to play with the capo on. */
  shapesKey: string;
}

export function capoFor(key: string): CapoOption[] {
  const k = parseKey(key);
  if (!k) return [];
  const friendly = k.mode === 'major' ? FRIENDLY_MAJOR : FRIENDLY_MINOR;
  const suffix = k.mode === 'minor' ? 'm' : '';
  return Array.from({ length: MAX_CAPO + 1 }, (_, capo) => ({
    capo,
    shapesKey: `${spell(Note.chroma(k.tonic)! - capo, 'neutral')}${suffix}`,
  })).filter((o) => friendly.has(o.shapesKey));
}
