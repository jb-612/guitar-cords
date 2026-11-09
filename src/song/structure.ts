/**
 * Song structure: section labels, repeat signs and alternate endings on bars, and
 * copy / paste / delete of several bars. Bars pasted or left after a delete keep
 * their own time signature and tempo (change markers are recalculated).
 */
import { placedBars, withMarkers, type Bar, type PlacedBar, type Song } from './song';

const MAX_REPEAT = 8;

const mapBar = (song: Song, i: number, patch: Partial<Bar>): Song => ({
  ...song,
  bars: song.bars.map((b, j) => (j === i ? { ...b, ...patch } : b)),
});

export const setSection = (song: Song, i: number, label: string | null): Song => mapBar(song, i, { section: label?.trim() || undefined });
export const setRepeatStart = (song: Song, i: number, on: boolean): Song => mapBar(song, i, { repeatStart: on || undefined });
export const setRepeatEnd = (song: Song, i: number, times: number | null): Song =>
  mapBar(song, i, { repeatEnd: times ? Math.max(2, Math.min(MAX_REPEAT, times)) : undefined });
export const setEndings = (song: Song, i: number, endings: number[]): Song => mapBar(song, i, { endings: endings.length ? [...endings].sort() : undefined });

/** Bars on the clipboard, with the meter and tempo they had. */
export type Clip = PlacedBar[];

export const copyBars = (song: Song, indexes: number[]): Clip => {
  const placed = placedBars(song);
  return [...indexes].sort((a, b) => a - b).flatMap((i) => (placed[i] ? [placed[i]] : []));
};

const fresh = (p: PlacedBar): PlacedBar => ({
  ...p,
  bar: { ...structuredClone(p.bar), id: crypto.randomUUID(), events: p.bar.events.map((e) => ({ ...structuredClone(e), id: crypto.randomUUID() })) },
});

/** Insert the clipboard after bar `after` (-1 = at the start). */
export function pasteBars(song: Song, after: number, clip: Clip): Song {
  if (clip.length === 0) return song;
  const placed = placedBars(song);
  placed.splice(after + 1, 0, ...clip.map(fresh));
  return withMarkers(song, placed);
}

export function deleteBars(song: Song, indexes: number[]): Song {
  const gone = new Set(indexes);
  const placed = placedBars(song).filter((_, i) => !gone.has(i));
  if (placed.length === 0) return { ...song, bars: [] };
  return withMarkers(song, placed);
}

