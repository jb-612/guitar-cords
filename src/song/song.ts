/**
 * Song model: a sequence of bars, each holding chords (with a length in beats)
 * and a lyric line. Pure functions; every change returns a new Song.
 */
import type { ChordShape } from '../music/chordShape';
import { suggestKeys, type KeySuggestion } from '../music/keyDetection';

export interface SongChord {
  id: string;
  symbol: string;
  shape: ChordShape;
  beats: number;
}

export interface Bar {
  id: string;
  chords: SongChord[];
  lyrics: string;
}

export interface Song {
  id: string;
  title: string;
  /** Key the creator accepted, e.g. "G" or "Em"; null until chosen. */
  key: string | null;
  tempo: number;
  beatsPerBar: number;
  bars: Bar[];
}

export interface ChordChoice {
  symbol: string;
  shape: ChordShape;
}

/** Fewer chords than this is not enough to guess a key from. */
const MIN_CHORDS_FOR_KEY = 3;

const newId = () => crypto.randomUUID();

export function createSong(title = 'Untitled song'): Song {
  return { id: newId(), title, key: null, tempo: 90, beatsPerBar: 4, bars: [] };
}

export const usedBeats = (bar: Bar) => bar.chords.reduce((sum, c) => sum + c.beats, 0);

/** Append a chord to the last bar if it fits, otherwise in a new bar. */
export function addChord(song: Song, choice: ChordChoice, beats = song.beatsPerBar): Song {
  const chord: SongChord = { id: newId(), ...choice, beats };
  const last = song.bars[song.bars.length - 1];
  if (last && usedBeats(last) + beats <= song.beatsPerBar) {
    return { ...song, bars: [...song.bars.slice(0, -1), { ...last, chords: [...last.chords, chord] }] };
  }
  return { ...song, bars: [...song.bars, { id: newId(), chords: [chord], lyrics: '' }] };
}

function mapBarWithChord(song: Song, chordId: string, fn: (bar: Bar) => Bar | null): Song {
  const bars = song.bars.flatMap((bar) => {
    if (!bar.chords.some((c) => c.id === chordId)) return [bar];
    const next = fn(bar);
    return next ? [next] : [];
  });
  return { ...song, bars };
}

export function removeChord(song: Song, chordId: string): Song {
  return mapBarWithChord(song, chordId, (bar) => {
    const chords = bar.chords.filter((c) => c.id !== chordId);
    return chords.length === 0 && !bar.lyrics ? null : { ...bar, chords };
  });
}

export function replaceChord(song: Song, chordId: string, choice: ChordChoice): Song {
  return mapBarWithChord(song, chordId, (bar) => ({
    ...bar,
    chords: bar.chords.map((c) => (c.id === chordId ? { ...c, ...choice } : c)),
  }));
}

/** Change a chord's length; returns the same song if the bar would overflow. */
export function setChordBeats(song: Song, chordId: string, beats: number): Song {
  const bar = song.bars.find((b) => b.chords.some((c) => c.id === chordId));
  const others = bar ? usedBeats(bar) - bar.chords.find((c) => c.id === chordId)!.beats : 0;
  if (!bar || beats < 1 || others + beats > song.beatsPerBar) return song;
  return mapBarWithChord(song, chordId, (b) => ({
    ...b,
    chords: b.chords.map((c) => (c.id === chordId ? { ...c, beats } : c)),
  }));
}

export function setLyrics(song: Song, barId: string, lyrics: string): Song {
  return { ...song, bars: song.bars.map((b) => (b.id === barId ? { ...b, lyrics } : b)) };
}

export const chordSymbols = (song: Song) => song.bars.flatMap((b) => b.chords.map((c) => c.symbol));

export function findChord(song: Song, chordId: string): SongChord | undefined {
  return song.bars.flatMap((b) => b.chords).find((c) => c.id === chordId);
}

/** Best-fitting key for the chord sequence, or null if there are too few chords. */
export function suggestedKey(song: Song): KeySuggestion | null {
  const symbols = chordSymbols(song);
  return symbols.length < MIN_CHORDS_FOR_KEY ? null : (suggestKeys(symbols)[0] ?? null);
}
