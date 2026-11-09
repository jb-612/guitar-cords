/**
 * Chord shape model: where fingers sit on a six-string fretboard.
 *
 * Conventions used throughout the app:
 * - String index 0 = low E (6th string) ... 5 = high E (1st string).
 * - Frets are absolute (1 = first fret). A string with no dot and not muted is open.
 * - Finger 1-4 = index..pinky, 0 = thumb (displayed as "T", never as "0",
 *   because "0" means an open string on chord diagrams).
 * - One dot per string. A barre is the same finger on several strings at one fret.
 * All functions are pure and return new shapes.
 */

export type Finger = 0 | 1 | 2 | 3 | 4;

export interface FretDot {
  string: number;
  fret: number;
  finger: Finger;
}

export interface ChordShape {
  dots: FretDot[];
  muted: number[];
}

export const STRING_COUNT = 6;
/** MIDI pitches of the open strings in standard tuning, low E first. */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64] as const;
export const VISIBLE_FRETS = 5;

export const EMPTY_SHAPE: ChordShape = { dots: [], muted: [] };

const dotOn = (shape: ChordShape, string: number) => shape.dots.find((d) => d.string === string);
const withoutString = (shape: ChordShape, string: number) => shape.dots.filter((d) => d.string !== string);
const unmute = (muted: number[], string: number) => muted.filter((s) => s !== string);

function nextFinger(shape: ChordShape, fret: number): Finger {
  const used = new Set(shape.dots.map((d) => d.finger));
  const free = ([1, 2, 3, 4] as const).find((f) => !used.has(f));
  if (free) return free;
  // All fingers busy: extend an existing barre on this fret, else the pinky.
  return shape.dots.find((d) => d.fret === fret)?.finger ?? 4;
}

// --- Barres ---------------------------------------------------------------
// A barre is one finger at one fret across several strings. Move, remove and
// change-finger act on the whole barre; nothing may sit under it (lower or same fret).

interface Barre {
  finger: Finger;
  fret: number;
  lo: number;
  hi: number;
}

const sameBarre = (d: FretDot, ref: { finger: Finger; fret: number }) => d.finger === ref.finger && d.fret === ref.fret;
const span = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const farthestFrom = (strings: number[], from: number) =>
  strings.reduce((best, s) => (Math.abs(s - from) > Math.abs(best - from) ? s : best), from);
const byString = (dots: FretDot[]) => [...dots].sort((a, b) => a.string - b.string);
const withoutBarre = (shape: ChordShape, b: Barre) => shape.dots.filter((d) => !sameBarre(d, b));

/** The barre a dot belongs to (its finger at its fret on 2+ strings), or null. */
function barreOf(shape: ChordShape, dot: FretDot): Barre | null {
  const strings = shape.dots.filter((d) => sameBarre(d, dot)).map((d) => d.string);
  if (strings.length < 2) return null;
  return { finger: dot.finger, fret: dot.fret, lo: Math.min(...strings), hi: Math.max(...strings) };
}

/** A barre lying across `string` (between its end strings), or null. */
function barreAcross(shape: ChordShape, string: number): Barre | null {
  for (const d of shape.dots) {
    const b = barreOf(shape, d);
    if (b && b.lo <= string && string <= b.hi) return b;
  }
  return null;
}

/** A finger at `fret` on `string` would be under a barre: impossible to play. */
function underBarre(shape: ChordShape, string: number, fret: number): boolean {
  const b = barreAcross(shape, string);
  return !!b && fret <= b.fret;
}

/** Lay a barre over `dots`: strings fretted higher keep their finger; lower dots and mutes give way. */
function layBarre(dots: FretDot[], muted: number[], b: Barre): ChordShape {
  const inRange = (s: number) => s >= b.lo && s <= b.hi;
  const kept = dots.filter((d) => !inRange(d.string) || d.fret > b.fret);
  const added = span(b.lo, b.hi)
    .filter((s) => !kept.some((d) => d.string === s))
    .map((s) => ({ string: s, fret: b.fret, finger: b.finger }));
  return { dots: byString([...kept, ...added]), muted: muted.filter((s) => !inRange(s)) };
}

/** Strings inside a barre with no finger of their own are held by the barre (e.g. after lifting a finger above it). */
function fillBarres(shape: ChordShape): ChordShape {
  const barres = shape.dots.map((d) => barreOf(shape, d)).filter((b): b is Barre => b !== null);
  const gaps = barres.flatMap((b) =>
    span(b.lo, b.hi)
      .filter((s) => !dotOn(shape, s) && !shape.muted.includes(s))
      .map((s) => ({ string: s, fret: b.fret, finger: b.finger })),
  );
  return gaps.length ? { ...shape, dots: byString([...shape.dots, ...gaps]) } : shape;
}

/** A loose finger keeps its number when moved by a tap; on a barred string the tap places a new finger above the barre. */
const fingerForTap = (shape: ChordShape, existing: FretDot | undefined, fret: number): Finger =>
  existing && !barreOf(shape, existing) ? existing.finger : nextFinger(shape, fret);

/** Tap on a string at a fret: add a dot, move this string's dot there, or remove it if tapped again. */
export function tapString(shape: ChordShape, string: number, fret: number): ChordShape {
  const existing = dotOn(shape, string);
  if (existing?.fret === fret) return removeDot(shape, string);
  if (underBarre(shape, string, fret)) return shape;
  const finger = fingerForTap(shape, existing, fret);
  return {
    dots: [...withoutString(shape, string), { string, fret, finger }],
    muted: unmute(shape.muted, string),
  };
}

/** Change a dot's finger; every piece of a barre changes together. */
export function setFinger(shape: ChordShape, string: number, finger: Finger): ChordShape {
  const dot = dotOn(shape, string);
  if (!dot) return shape;
  const b = barreOf(shape, dot);
  const hit = (d: FretDot) => (b ? sameBarre(d, b) : d.string === string);
  return { ...shape, dots: shape.dots.map((d) => (hit(d) ? { ...d, finger } : d)) };
}

const onBoard = (to: { string: number; fret: number }) => to.fret >= 1 && to.string >= 0 && to.string < STRING_COUNT;

/** Drag a dot to a new string/fret (a barre piece drags the whole barre). Returns the same shape if not allowed. */
export function moveDot(shape: ChordShape, fromString: number, to: { string: number; fret: number }): ChordShape {
  const dot = dotOn(shape, fromString);
  if (!dot || !onBoard(to)) return shape;
  const b = barreOf(shape, dot);
  return b ? moveBarre(shape, b, to.string - fromString, to.fret) : moveSingle(shape, dot, to);
}

/** Slide a whole barre; refused if it leaves the board or would cover other fingers. */
function moveBarre(shape: ChordShape, b: Barre, dString: number, fret: number): ChordShape {
  const moved = { ...b, lo: b.lo + dString, hi: b.hi + dString, fret };
  const rest = withoutBarre(shape, b);
  const covers = rest.some((d) => d.string >= moved.lo && d.string <= moved.hi && d.fret <= fret);
  if (moved.lo < 0 || moved.hi >= STRING_COUNT || covers) return shape;
  return layBarre(rest, shape.muted, moved);
}

/** Move one finger. It may replace a barre piece (sitting above the barre) but never another finger. */
function moveSingle(shape: ChordShape, dot: FretDot, to: { string: number; fret: number }): ChordShape {
  const target = dotOn(shape, to.string);
  const blockedByFinger = !!target && target.string !== dot.string && !barreOf(shape, target);
  if (blockedByFinger || underBarre(shape, to.string, to.fret)) return shape;
  const rest = shape.dots.filter((d) => d.string !== dot.string && d.string !== to.string);
  return fillBarres({
    dots: byString([...rest, { ...dot, string: to.string, fret: to.fret }]),
    muted: unmute(shape.muted, to.string),
  });
}

export type Refusal = 'under-barre' | 'occupied' | 'off-board';

/** Why a finger can't go to `to` (moving from `fromString`, if it is a move), or null if it can. */
export function placementProblem(shape: ChordShape, to: { string: number; fret: number }, fromString?: number): Refusal | null {
  if (!onBoard(to)) return 'off-board';
  if (underBarre(shape, to.string, to.fret)) return 'under-barre';
  return takenByOther(shape, to.string, fromString) ? 'occupied' : null;
}

/** Another finger (not a barre piece, not the one being moved) is on this string. */
function takenByOther(shape: ChordShape, string: number, fromString?: number): boolean {
  const target = dotOn(shape, string);
  return !!target && target.string !== fromString && !barreOf(shape, target);
}

/** Lift a finger. Removing any piece of a barre lifts the whole barre. */
export function removeDot(shape: ChordShape, string: number): ChordShape {
  const dot = dotOn(shape, string);
  if (!dot) return shape;
  const b = barreOf(shape, dot);
  return b ? { ...shape, dots: withoutBarre(shape, b) } : fillBarres({ ...shape, dots: withoutString(shape, string) });
}

/**
 * Stretch the finger on `anchor` into a barre reaching string `to`, at the anchor's fret.
 * The far end of any existing barre stays fixed, so dragging an end grows or shrinks it.
 * Strings in range fretted higher keep their own finger (like the F shape); lower or
 * same-fret dots and mutes are replaced by the barre.
 */
export function barreTo(shape: ChordShape, anchor: number, to: number): ChordShape {
  const ref = dotOn(shape, anchor);
  if (!ref || to < 0 || to >= STRING_COUNT) return shape;
  const members = shape.dots.filter((d) => sameBarre(d, ref)).map((d) => d.string);
  const fixed = farthestFrom(members, anchor);
  const rest = shape.dots.filter((d) => !sameBarre(d, ref));
  return layBarre(rest, shape.muted, { finger: ref.finger, fret: ref.fret, lo: Math.min(fixed, to), hi: Math.max(fixed, to) });
}

/** Grow the barre that `string` belongs to by one string in direction `dir` (+1 toward high E). */
export function extendBarre(shape: ChordShape, string: number, dir: 1 | -1): ChordShape {
  const ref = dotOn(shape, string);
  if (!ref) return shape;
  const members = shape.dots.filter((d) => sameBarre(d, ref)).map((d) => d.string);
  const edge = dir > 0 ? Math.max(...members) : Math.min(...members);
  return barreTo(shape, edge, edge + dir);
}

/** Toggle a string between muted and open. Muting a fretted string removes its dot. */
export function toggleMute(shape: ChordShape, string: number): ChordShape {
  if (shape.muted.includes(string)) return { ...shape, muted: unmute(shape.muted, string) };
  return { dots: withoutString(shape, string), muted: [...shape.muted, string].sort() };
}

/** Move the whole shape along the neck. Returns null if any dot would leave the fretboard. */
export function shiftShape(shape: ChordShape, frets: number): ChordShape | null {
  if (shape.dots.some((d) => d.fret + frets < 1)) return null;
  return { ...shape, dots: shape.dots.map((d) => ({ ...d, fret: d.fret + frets })) };
}

/** MIDI pitch per string (low E first); null for muted strings. */
export function soundingMidi(shape: ChordShape, tuning: readonly number[] = STANDARD_TUNING): (number | null)[] {
  return tuning.map((open, string) => {
    if (shape.muted.includes(string)) return null;
    return open + (dotOn(shape, string)?.fret ?? 0);
  });
}

/** First fret to show in a diagram window: the nut if the shape fits there, else its lowest fret. */
export function viewStartFret(shape: ChordShape): number {
  const frets = shape.dots.map((d) => d.fret);
  if (frets.length === 0 || Math.max(...frets) <= VISIBLE_FRETS) return 1;
  return Math.min(...frets);
}

/** "x32010" style text: one char per string (low E first), or dash-separated for frets >= 10. */
export function toFretString(shape: ChordShape): string {
  const parts = Array.from({ length: STRING_COUNT }, (_, s) =>
    shape.muted.includes(s) ? 'x' : String(dotOn(shape, s)?.fret ?? 0),
  );
  return parts.some((p) => p.length > 1) ? parts.join('-') : parts.join('');
}

/** Parse "x32010" or "x-10-12-12-10-x" and assign standard fingers. */
export function shapeFromFrets(text: string): ChordShape {
  const parts = text.includes('-') ? text.split('-') : text.split('');
  const muted: number[] = [];
  const fretted: { string: number; fret: number }[] = [];
  parts.forEach((p, string) => {
    if (p.toLowerCase() === 'x') muted.push(string);
    else if (Number(p) > 0) fretted.push({ string, fret: Number(p) });
  });
  return { muted, dots: assignFingers(fretted) };
}

/**
 * Suggest a natural fingering: a finger-1 barre on the lowest fret when more than
 * four strings are fretted, then remaining notes by fret (low to high) and string.
 */
export function assignFingers(fretted: { string: number; fret: number }[]): FretDot[] {
  const sorted = [...fretted].sort((a, b) => a.fret - b.fret || a.string - b.string);
  const minFret = sorted[0]?.fret;
  const barre = sorted.length > 4 ? sorted.filter((d) => d.fret === minFret) : [];
  const rest = sorted.filter((d) => !barre.includes(d));
  const firstFinger = barre.length > 0 ? 2 : 1;
  return [
    ...barre.map((d) => ({ ...d, finger: 1 as Finger })),
    ...rest.map((d, i) => ({ ...d, finger: Math.min(firstFinger + i, 4) as Finger })),
  ];
}
