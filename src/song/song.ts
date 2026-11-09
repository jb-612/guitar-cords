/**
 * Song model. A song is bars of events: chord hits and rests, with lengths in units
 * of a 1/32 note (see rhythm.ts). Invariant: every bar's events add up exactly to its
 * time signature, so time is never lost or invented. Unused time is an explicit rest,
 * which the creator can fill. Bars may carry a time-signature or tempo change that
 * applies from that bar on. All functions are pure and return a new Song.
 */
import { toFretString, type ChordShape } from '../music/chordShape';
import { suggestKeys, type KeySuggestion } from '../music/keyDetection';
import { barUnits, defaultDirection, sameTimeSignature, type TimeSignature } from './rhythm';

export type Direction = 'down' | 'up';
export type PlayStyle = 'strum' | 'arpeggio';
export type Sustain = 'ring' | 'cut';

export interface ChordHit {
  id: string;
  kind: 'chord';
  symbol: string;
  shape: ChordShape;
  units: number;
  direction: Direction;
  style: PlayStyle;
  sustain: Sustain;
}

export interface RestEvent {
  id: string;
  kind: 'rest';
  units: number;
}

export type SongEvent = ChordHit | RestEvent;

export interface Bar {
  id: string;
  events: SongEvent[];
  lyrics: string;
  /** Meter change starting at this bar. */
  timeSignature?: TimeSignature;
  /** Tempo change (bpm) starting at this bar. */
  tempo?: number;
}

export interface Song {
  id: string;
  title: string;
  /** Key the creator accepted, e.g. "G" or "Em"; null until chosen. */
  key: string | null;
  /** Tempo at the start of the song. */
  tempo: number;
  /** Meter at the start of the song. */
  timeSignature: TimeSignature;
  bars: Bar[];
  /** Last change, ms since epoch (library ordering and sync). */
  updatedAt?: number;
  /** Capo fret (0 = none). Shapes and names are as played; the song sounds this many semitones higher. */
  capo?: number;
}

export interface ChordChoice {
  symbol: string;
  shape: ChordShape;
}

export interface SongSetup {
  title?: string;
  timeSignature?: TimeSignature;
  tempo?: number;
}

export type HitStyle = Partial<Pick<ChordHit, 'direction' | 'style' | 'sustain'>>;

/** Fewer chords than this is not enough to guess a key from. */
const MIN_CHORDS_FOR_KEY = 3;

const newId = () => crypto.randomUUID();
const rest = (units: number): RestEvent => ({ id: newId(), kind: 'rest', units });
const newHit = (choice: ChordChoice, units: number, start: number): ChordHit => ({
  id: newId(),
  kind: 'chord',
  symbol: choice.symbol,
  shape: choice.shape,
  units,
  direction: defaultDirection(start),
  style: 'strum',
  sustain: 'ring',
});
const total = (events: SongEvent[]) => events.reduce((n, e) => n + e.units, 0);

export function createSong(setup: SongSetup = {}): Song {
  return {
    id: newId(),
    title: setup.title ?? 'Untitled song',
    key: null,
    tempo: setup.tempo ?? 90,
    timeSignature: setup.timeSignature ?? { beats: 4, unit: 4 },
    bars: [],
  };
}

// --- Meter and tempo --------------------------------------------------------

/** The value of the last change at or before bar `i`, else the song default. */
function inEffect<T>(song: Song, i: number, pick: (b: Bar) => T | undefined, fallback: T): T {
  for (let j = Math.min(i, song.bars.length - 1); j >= 0; j--) {
    const v = pick(song.bars[j]!);
    if (v !== undefined) return v;
  }
  return fallback;
}

export const barTimeSignature = (song: Song, i: number) => inEffect(song, i, (b) => b.timeSignature, song.timeSignature);
export const tempoAt = (song: Song, i: number) => inEffect(song, i, (b) => b.tempo, song.tempo);
const capacity = (song: Song, i: number) => barUnits(barTimeSignature(song, i));

// --- Event list helpers -----------------------------------------------------

/** Drop empty events and merge neighbouring rests. */
function tidy(events: SongEvent[]): SongEvent[] {
  return events.reduce<SongEvent[]>((out, e) => {
    const last = out[out.length - 1];
    if (e.units <= 0) return out;
    if (last?.kind === 'rest' && e.kind === 'rest') return [...out.slice(0, -1), { ...last, units: last.units + e.units }];
    return [...out, e];
  }, []);
}

/** Take `amount` units from the front of `events` (rests shrink, chords start later or vanish). */
function consume(events: SongEvent[], amount: number): SongEvent[] {
  let left = amount;
  return events.map((e) => {
    const take = Math.min(e.units, left);
    left -= take;
    return take ? { ...e, units: e.units - take } : e;
  });
}

/** Make `amount` units of room at the front of `events` by shrinking rests (pushing chords later); chords give way only if rests run out. */
function makeRoom(events: SongEvent[], amount: number): SongEvent[] {
  let left = amount;
  const fromRests = events.map((e) => {
    if (e.kind !== 'rest') return e;
    const take = Math.min(e.units, left);
    left -= take;
    return { ...e, units: e.units - take };
  });
  return [...consume(fromRests.reverse(), left)].reverse();
}

/** Remove `amount` units from the end: rests first, then the last chords. */
function trimEnd(events: SongEvent[], amount: number): SongEvent[] {
  const restTime = events.filter((e) => e.kind === 'rest').reduce((n, e) => n + e.units, 0);
  const fromRests = Math.min(restTime, amount);
  const lessRest = consume([...events].reverse().filter((e) => e.kind === 'rest'), fromRests);
  const merged = events.map((e) => lessRest.find((r) => r.id === e.id) ?? e);
  return consume([...merged].reverse(), amount - fromRests).reverse();
}

/** Make a bar's events add up to `units`. */
function refit(bar: Bar, units: number): Bar {
  const have = total(bar.events);
  if (have === units) return bar;
  const events = have < units ? [...bar.events, rest(units - have)] : trimEnd(bar.events, have - units);
  return { ...bar, events: tidy(events) };
}

/** Refit every bar to the meter in effect there (after meter changes or bar moves). */
const normalize = (song: Song): Song => ({ ...song, bars: song.bars.map((b, i) => refit(b, capacity(song, i))) });

const emptyBar = (units: number): Bar => ({ id: newId(), events: [rest(units)], lyrics: '' });

export interface EventLocation {
  barIndex: number;
  index: number;
  event: SongEvent;
  /** Units from the start of the bar. */
  start: number;
}

export function findEvent(song: Song, id: string): EventLocation | null {
  for (const [barIndex, bar] of song.bars.entries()) {
    const index = bar.events.findIndex((e) => e.id === id);
    if (index >= 0) return { barIndex, index, event: bar.events[index]!, start: total(bar.events.slice(0, index)) };
  }
  return null;
}

/** Replace the events of the bar holding `at` with `fn(before, event, after)`. */
function editAt(song: Song, at: EventLocation, fn: (before: SongEvent[], event: SongEvent, after: SongEvent[]) => SongEvent[]): Song {
  const bar = song.bars[at.barIndex]!;
  const events = tidy(fn(bar.events.slice(0, at.index), at.event, bar.events.slice(at.index + 1)));
  return { ...song, bars: song.bars.map((b, i) => (i === at.barIndex ? { ...b, events } : b)) };
}

const chordAt = (song: Song, id: string) => {
  const at = findEvent(song, id);
  return at?.event.kind === 'chord' ? (at as EventLocation & { event: ChordHit }) : null;
};

// --- Adding and editing -----------------------------------------------------

/** Put a chord into a rest, filling it (or the first `units` of it). */
export function fillRest(song: Song, restId: string, choice: ChordChoice, units?: number): Song {
  const at = findEvent(song, restId);
  if (at?.event.kind !== 'rest') return song;
  const len = Math.min(units ?? at.event.units, at.event.units);
  return editAt(song, at, (before, r, after) => [...before, newHit(choice, len, at.start), rest(r.units - len), ...after]);
}

/** The rest that ends the last bar, if a chord of `units` (or any length, when omitted) fits in it. */
const lastEvent = (song: Song) => song.bars.at(-1)?.events.at(-1);

function trailingRest(song: Song, units?: number): RestEvent | null {
  const tail = lastEvent(song);
  if (tail?.kind !== 'rest') return null;
  return units === undefined || units <= tail.units ? tail : null;
}

/** Append a chord: into the rest that ends the last bar if it fits, otherwise into a new bar. With no length it fills the space. */
export function addChord(song: Song, choice: ChordChoice, units?: number): Song {
  const tail = trailingRest(song, units);
  if (tail) return fillRest(song, tail.id, choice, units);
  const withBar = insertBar(song, song.bars.length);
  return fillRest(withBar, withBar.bars[withBar.bars.length - 1]!.events[0]!.id, choice, units);
}

/** Change a chord's length. Shorter leaves a rest after it; longer takes time from what follows; never past the bar end. */
export function setLength(song: Song, id: string, units: number): Song {
  const at = chordAt(song, id);
  if (!at) return song;
  const len = Math.max(1, Math.min(units, capacity(song, at.barIndex) - at.start));
  const delta = len - at.event.units;
  return editAt(song, at, (before, e, after) => [...before, { ...e, units: len }, ...(delta < 0 ? [rest(-delta), ...after] : consume(after, delta))]);
}

export function setHitStyle(song: Song, id: string, style: HitStyle): Song {
  const at = chordAt(song, id);
  return at ? editAt(song, at, (before, e, after) => [...before, { ...e, ...style }, ...after]) : song;
}

/** A chord becomes a rest of the same length. */
export function removeEvent(song: Song, id: string): Song {
  const at = findEvent(song, id);
  return at ? editAt(song, at, (before, e, after) => [...before, rest(e.units), ...after]) : song;
}

/** Insert a copy right after a hit (strumming patterns). Later hits move along into the rest that follows; a full bar continues in a new bar. */
export function repeatHit(song: Song, id: string): Song {
  const at = chordAt(song, id);
  if (!at) return song;
  const space = capacity(song, at.barIndex) - at.start - at.event.units;
  if (space === 0) return repeatIntoNewBar(song, at);
  const copy: ChordHit = { ...at.event, id: newId(), units: Math.min(at.event.units, space), direction: defaultDirection(at.start + at.event.units) };
  return editAt(song, at, (before, e, after) => [...before, e, copy, ...makeRoom(after, copy.units)]);
}

function repeatIntoNewBar(song: Song, at: EventLocation & { event: ChordHit }): Song {
  const withBar = insertBar(song, at.barIndex + 1);
  const restId = withBar.bars[at.barIndex + 1]!.events[0]!.id;
  const filled = fillRest(withBar, restId, at.event, at.event.units);
  const copy = filled.bars[at.barIndex + 1]!.events[0]!;
  return setHitStyle(filled, copy.id, { style: at.event.style, sustain: at.event.sustain });
}

const voicingKey = (h: ChordHit) => `${h.symbol}|${toFretString(h.shape)}`;
const chordOf = (h: ChordHit): ChordChoice => ({ symbol: h.symbol, shape: h.shape });
const mapEvents = (song: Song, fn: (e: SongEvent) => SongEvent): Song => ({
  ...song,
  bars: song.bars.map((b) => ({ ...b, events: b.events.map(fn) })),
});

/** New name/fingering for every hit that shares this hit's name and fingering. */
export function replaceVoicing(song: Song, id: string, choice: ChordChoice): Song {
  const at = chordAt(song, id);
  if (!at) return song;
  const key = voicingKey(at.event);
  return mapEvents(song, (e) => (e.kind === 'chord' && voicingKey(e) === key ? { ...e, ...choice } : e));
}

/** New name/fingering for this one hit only (e.g. G -> G/F# in a bass walk). */
export function replaceHit(song: Song, id: string, choice: ChordChoice): Song {
  return mapEvents(song, (e) => (e.id === id && e.kind === 'chord' ? { ...e, ...choice } : e));
}

/** How many other hits use the same name and fingering as this one. */
export function sameVoicingCount(song: Song, id: string): number {
  const at = chordAt(song, id);
  if (!at) return 0;
  const key = voicingKey(at.event);
  return song.bars.flatMap((b) => b.events).filter((e) => e.kind === 'chord' && e.id !== id && voicingKey(e) === key).length;
}

/**
 * Drag and drop. Onto a rest: the hit moves there (as long as fits) and leaves a rest behind.
 * Onto another hit: the two chords swap, each slot keeping its rhythm. `copy` keeps the original.
 */
export function moveHit(song: Song, id: string, targetId: string, opts: { copy?: boolean } = {}): Song {
  const from = chordAt(song, id);
  const to = dropTarget(song, id, targetId);
  if (!from || !to) return song;
  const copy = opts.copy === true;
  return to.event.kind === 'rest' ? moveIntoRest(song, from.event, to, copy) : swapChords(song, from.event, to.event, copy);
}

const dropTarget = (song: Song, id: string, targetId: string) => (id === targetId ? null : findEvent(song, targetId));

function moveIntoRest(song: Song, hit: ChordHit, to: EventLocation, copy: boolean): Song {
  const units = Math.min(hit.units, to.event.units);
  const placed = editAt(song, to, (before, r, after) => [...before, { ...hit, id: newId(), units }, rest(r.units - units), ...after]);
  return copy ? placed : removeEvent(placed, hit.id);
}

function swapChords(song: Song, a: ChordHit, b: ChordHit, copy: boolean): Song {
  const [toB, toA] = [chordOf(a), chordOf(b)];
  return mapEvents(song, (e) => {
    if (e.id === b.id) return { ...e, ...toB };
    return !copy && e.id === a.id ? { ...e, ...toA } : e;
  });
}

export function setLyrics(song: Song, barId: string, lyrics: string): Song {
  return { ...song, bars: song.bars.map((b) => (b.id === barId ? { ...b, lyrics } : b)) };
}

// --- Meter, tempo and bar structure ----------------------------------------

const withBarField = <K extends 'timeSignature' | 'tempo'>(song: Song, i: number, key: K, value: Bar[K]): Song => ({
  ...song,
  bars: song.bars.map((b, j) => (j === i ? { ...b, [key]: value } : b)),
});

/** Change the meter from bar `i` on (until the next change). Bars are resized to stay full. */
export function setTimeSignatureFrom(song: Song, i: number, ts: TimeSignature): Song {
  if (i === 0) return normalize({ ...withBarField(song, 0, 'timeSignature', undefined), timeSignature: ts });
  const unchanged = sameTimeSignature(ts, barTimeSignature(song, i - 1));
  return normalize(withBarField(song, i, 'timeSignature', unchanged ? undefined : ts));
}

/** Change the tempo from bar `i` on; null (or the tempo already in effect) removes the change. */
export function setTempoFrom(song: Song, i: number, bpm: number | null): Song {
  if (i === 0) return bpm === null ? song : { ...withBarField(song, 0, 'tempo', undefined), tempo: bpm };
  const unchanged = bpm === null || bpm === tempoAt(song, i - 1);
  return withBarField(song, i, 'tempo', unchanged ? undefined : bpm);
}

/** Insert an empty bar (one rest) at `index`, in the meter of that position. */
export function insertBar(song: Song, index: number): Song {
  const bars = [...song.bars];
  bars.splice(index, 0, emptyBar(barUnits(barTimeSignature(song, index - 1))));
  return normalize({ ...song, bars });
}

/** A bar with the meter and tempo actually in effect there. */
interface PlacedBar {
  bar: Bar;
  ts: TimeSignature;
  tempo: number;
}

const tsChange = (prev: PlacedBar | undefined, cur: PlacedBar) => (prev && !sameTimeSignature(prev.ts, cur.ts) ? cur.ts : undefined);
const tempoChange = (prev: PlacedBar | undefined, cur: PlacedBar) => (prev && prev.tempo !== cur.tempo ? cur.tempo : undefined);

/** Rebuild change markers from each bar's own meter/tempo: a marker only where a bar differs from the one before. */
function withMarkers(song: Song, placed: PlacedBar[]): Song {
  const bars = placed.map((p, i) => ({ ...p.bar, timeSignature: tsChange(placed[i - 1], p), tempo: tempoChange(placed[i - 1], p) }));
  return { ...song, timeSignature: placed[0]!.ts, tempo: placed[0]!.tempo, bars };
}

const inBars = (song: Song, i: number) => i >= 0 && i < song.bars.length;

/** Move bar `from` to position `to`. Every bar keeps its own time signature and tempo. */
export function moveBar(song: Song, from: number, to: number): Song {
  if (from === to || !inBars(song, from) || !inBars(song, to)) return song;
  const placed = song.bars.map((bar, i) => ({ bar, ts: barTimeSignature(song, i), tempo: tempoAt(song, i) }));
  const [moving] = placed.splice(from, 1);
  placed.splice(to, 0, moving!);
  return withMarkers(song, placed);
}

/** Copy a bar right after itself (new ids; meter/tempo changes are not repeated). */
export function duplicateBar(song: Song, index: number): Song {
  const bar = song.bars[index];
  if (!bar) return song;
  const copy: Bar = { ...bar, id: newId(), timeSignature: undefined, tempo: undefined, events: bar.events.map((e) => ({ ...e, id: newId() })) };
  return normalize({ ...song, bars: [...song.bars.slice(0, index + 1), copy, ...song.bars.slice(index + 1)] });
}

/** Delete a bar. Changes that started there move to the next bar so the rest of the song keeps its meter and tempo. */
export function deleteBar(song: Song, index: number): Song {
  const gone = song.bars[index];
  if (!gone) return song;
  const next = song.bars[index + 1];
  const inherited = next && { ...next, timeSignature: next.timeSignature ?? gone.timeSignature, tempo: next.tempo ?? gone.tempo };
  const bars = song.bars.flatMap((b, i) => (i === index ? [] : i === index + 1 ? [inherited!] : [b]));
  return normalize({ ...song, bars });
}

// --- Reading ----------------------------------------------------------------

/** Chord names in order, a held or re-strummed chord counted once. */
export function chordSymbols(song: Song): string[] {
  const hits = song.bars.flatMap((b) => b.events).filter((e): e is ChordHit => e.kind === 'chord');
  return hits.map((h) => h.symbol).filter((s, i, all) => s !== all[i - 1]);
}

/** Best-fitting key for the chord sequence, or null if there are too few chords. */
export function suggestedKey(song: Song): KeySuggestion | null {
  const symbols = chordSymbols(song);
  return symbols.length < MIN_CHORDS_FOR_KEY ? null : (suggestKeys(symbols)[0] ?? null);
}

// --- Stored songs from earlier versions -----------------------------------

interface V1Song {
  id: string;
  title: string;
  key: string | null;
  tempo: number;
  beatsPerBar: number;
  bars: { id: string; lyrics: string; chords: { id: string; symbol: string; shape: ChordShape; beats: number }[] }[];
}

const QUARTER_UNITS = 8;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Upgrade a stored song to the current model; null if it isn't a song. */
export function migrateSong(raw: unknown): Song | null {
  if (!isObject(raw) || !Array.isArray(raw.bars) || typeof raw.title !== 'string') return null;
  if (isObject(raw.timeSignature)) return raw as unknown as Song;
  return fromV1(raw as unknown as V1Song);
}

function fromV1(old: V1Song): Song {
  const timeSignature: TimeSignature = { beats: old.beatsPerBar || 4, unit: 4 };
  const bars = old.bars.map((b) => ({
    id: b.id,
    lyrics: b.lyrics ?? '',
    events: b.chords.map((c): SongEvent => ({ ...newHit(c, c.beats * QUARTER_UNITS, 0), id: c.id, direction: 'down' })),
  }));
  return normalize({ id: old.id, title: old.title, key: old.key ?? null, tempo: old.tempo || 90, timeSignature, bars });
}
