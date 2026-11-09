/**
 * Note events: single notes or small groups (riffs, bass lines) written as tab,
 * string + fret per note. They live in bars next to chord hits and follow the same
 * rhythm rules (length, duplicate, drag, delete all work through song.ts).
 */
import { STRING_COUNT, type ChordShape } from '../music/chordShape';
import { appendEvent, findEvent, placeInRest, type ChordHit, type NoteEvent, type Song, type SongEvent, type TabNote } from './song';

export const MAX_FRET = 24;

const valid = (n: TabNote) => Number.isInteger(n.string) && n.string >= 0 && n.string < STRING_COUNT && n.fret >= 0 && n.fret <= MAX_FRET;

/** At most one note per string (the last one given wins), low string first. */
export function cleanNotes(notes: TabNote[]): TabNote[] {
  const byString = new Map(notes.filter(valid).map((n) => [n.string, { string: n.string, fret: n.fret }]));
  return [...byString.values()].sort((a, b) => a.string - b.string);
}

const newNotes = (notes: TabNote[]) => (units: number): NoteEvent => ({ id: crypto.randomUUID(), kind: 'notes', notes: cleanNotes(notes), units });

/** Append notes after the last event (a new bar when the last one is full). */
export const addNotes = (song: Song, notes: TabNote[], units?: number): Song => appendEvent(song, newNotes(notes), units);

/** Put notes into a rest. */
export const fillRestWithNotes = (song: Song, restId: string, notes: TabNote[], units?: number): Song => placeInRest(song, restId, newNotes(notes), units);

/** Change which notes a note event plays. */
export function setNotes(song: Song, id: string, notes: TabNote[]): Song {
  if (findEvent(song, id)?.event.kind !== 'notes') return song;
  const clean = cleanNotes(notes);
  return { ...song, bars: song.bars.map((b) => ({ ...b, events: b.events.map((e) => (e.id === id && e.kind === 'notes' ? { ...e, notes: clean } : e)) })) };
}

/** The notes as a shape: fretted notes are dots, strings without a note are muted. */
export function notesShape(notes: TabNote[]): ChordShape {
  const used = new Set(notes.map((n) => n.string));
  return {
    dots: notes.filter((n) => n.fret > 0).map((n) => ({ string: n.string, fret: n.fret, finger: 1 })),
    muted: Array.from({ length: STRING_COUNT }, (_, s) => s).filter((s) => !used.has(s)),
  };
}

/** A note event seen as a plain, nameless hit (for exports that only need pitches and rhythm). */
export const notesAsHit = (e: NoteEvent): ChordHit => ({ id: e.id, kind: 'chord', symbol: '', shape: notesShape(e.notes), units: e.units, direction: 'down', style: 'strum', sustain: e.sustain ?? 'ring' });

/** Every sounding event as a hit, rests left out. */
export const soundingHits = (events: SongEvent[]): ChordHit[] => events.flatMap((e) => (e.kind === 'chord' ? [e] : e.kind === 'notes' ? [notesAsHit(e)] : []));

/** One fret moved `n` semitones on its string, by an octave more or less if it would leave the neck. */
const shiftFret = (fret: number, n: number) => {
  const f = fret + n;
  if (f < 0) return f + 12;
  return f > MAX_FRET ? f - 12 : f;
};

/** Every note moved `n` semitones, each on its own string. */
export const shiftNotes = (notes: TabNote[], n: number): TabNote[] => notes.map((t) => ({ ...t, fret: shiftFret(t.fret, n) }));

/** Tab label like "0" or "3·5" (strings low to high), for lanes and screen readers. */
export const notesLabel = (e: NoteEvent) => e.notes.map((n) => n.fret).join('·') || '–';
