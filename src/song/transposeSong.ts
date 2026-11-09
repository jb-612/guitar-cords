/**
 * Transpose a whole song, change its key, and work with a capo.
 * - transposeSong: chord names move and are respelled for the new key; every hit gets a
 *   fingering for its new name (open shapes first), or a custom fingering slides along the neck.
 * - withCapo / playInShapes: keep (or switch to easier) shapes and let a capo set the pitch.
 * `song.key` is the key of the shapes as written; the song sounds `capo` semitones higher.
 */
import { Note } from '@tonaljs/tonal';
import { shiftShape, type ChordShape } from '../music/chordShape';
import { formatKey, mod12, parseKey, spellingForKey } from '../music/chordSymbol';
import { transposeChord } from '../music/transpose';
import { suggestVoicings } from '../music/voicings';
import { isStandard } from '../music/tunings';
import { shiftNotes } from './notes';
import type { ChordHit, Song, SongEvent } from './song';

export const MAX_CAPO = 11;
const FRETS_ON_NECK = 15;

/** Key name `n` semitones away, spelled like guitarists usually name keys. */
function keyMoved(key: string, n: number): string {
  const k = parseKey(key);
  if (!k) return key;
  const tonic = transposeChord(k.tonic, n, k.mode === 'major' ? 'neutral' : 'sharps');
  return formatKey({ tonic: tonic === 'Gb' && k.mode === 'major' ? 'F#' : tonic, mode: k.mode });
}

/** Semitones from one key to another, the shorter way round (-5..+6). */
export function semitonesBetween(from: string, to: string): number {
  const a = parseKey(from);
  const b = parseKey(to);
  if (!a || !b) return 0;
  const up = mod12(Note.chroma(b.tonic)! - Note.chroma(a.tonic)!);
  return up > 6 ? up - 12 : up;
}

/** Slide a fingering `n` frets, wrapping by an octave if it would leave the neck. Open strings can't slide. */
function slide(shape: ChordShape, n: number): ChordShape | null {
  const candidates = [n, n - 12, n + 12].map((k) => shiftShape(shape, k)).filter((s): s is ChordShape => s !== null);
  return candidates.find((s) => s.dots.every((d) => d.fret <= FRETS_ON_NECK)) ?? null;
}

const hasOpenStrings = (shape: ChordShape) => shape.dots.length + shape.muted.length < 6;

/** New fingering for a hit moved `n` semitones: the suggested voicing for its new name, else the old shape slid along. */
function revoice(hit: ChordHit, symbol: string, n: number, standard: boolean): ChordShape {
  const suggested = standard ? suggestVoicings(symbol)[0]?.shape : undefined;
  return suggested ?? slid(hit.shape, n);
}

/** The shape moved along the neck, or unchanged if it has open strings (they can't move). */
const slid = (shape: ChordShape, n: number) => (hasOpenStrings(shape) ? shape : (slide(shape, n) ?? shape));

export function transposeSong(song: Song, n: number): Song {
  if (n === 0) return song;
  const key = song.key ? keyMoved(song.key, n) : null;
  const spelling = spellingForKey(key ?? undefined);
  const move = (e: SongEvent): SongEvent => {
    if (e.kind === 'notes') return { ...e, notes: shiftNotes(e.notes, n) };
    if (e.kind !== 'chord') return e;
    const symbol = transposeChord(e.symbol, n, spelling);
    return { ...e, symbol, shape: revoice(e, symbol, n, isStandard(song.tuning)) };
  };
  return { ...song, key, bars: song.bars.map((b) => ({ ...b, events: b.events.map(move) })) };
}

/** Set the capo (0-11). Shapes and names stay; the song sounds that many semitones higher. */
export const withCapo = (song: Song, capo: number): Song => ({ ...song, capo: Math.max(0, Math.min(MAX_CAPO, capo)) });

/** Key the song actually sounds in (written key raised by the capo). */
export const soundingKey = (song: Song): string | null => (song.key ? keyMoved(song.key, song.capo ?? 0) : null);

/** Sound the same but play shapes from `shapesKey` (e.g. G shapes), with the capo making up the difference. */
export function playInShapes(song: Song, shapesKey: string): Song {
  const sounding = soundingKey(song);
  if (!sounding) return song;
  const capo = mod12(semitonesBetween(shapesKey, sounding));
  const written = song.key ?? sounding;
  return withCapo(transposeSong(song, semitonesBetween(written, shapesKey)), capo);
}
