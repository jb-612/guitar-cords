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

const partOfBarre = (shape: ChordShape, dot: FretDot) =>
  shape.dots.some((d) => d.string !== dot.string && d.finger === dot.finger && d.fret === dot.fret);

/** Tap on a string at a fret: add a dot, move this string's dot there, or remove it if tapped again. */
export function tapString(shape: ChordShape, string: number, fret: number): ChordShape {
  const existing = dotOn(shape, string);
  if (existing?.fret === fret) return { ...shape, dots: withoutString(shape, string) };
  // A string under a barre keeps the barre; the tap places a new finger above it.
  const keepsFinger = existing && !partOfBarre(shape, existing);
  const finger = keepsFinger ? existing.finger : nextFinger(shape, fret);
  return {
    dots: [...withoutString(shape, string), { string, fret, finger }],
    muted: unmute(shape.muted, string),
  };
}

export function setFinger(shape: ChordShape, string: number, finger: Finger): ChordShape {
  return { ...shape, dots: shape.dots.map((d) => (d.string === string ? { ...d, finger } : d)) };
}

/** Drag a dot to a new string/fret. Returns the same shape if the drop is not allowed. */
const onBoard = (to: { string: number; fret: number }) => to.fret >= 1 && to.string >= 0 && to.string < STRING_COUNT;

export function moveDot(shape: ChordShape, fromString: number, to: { string: number; fret: number }): ChordShape {
  const dot = dotOn(shape, fromString);
  const occupied = to.string !== fromString && !!dotOn(shape, to.string);
  if (!dot || occupied || !onBoard(to)) return shape;
  return {
    dots: [...withoutString(shape, fromString), { ...dot, string: to.string, fret: to.fret }],
    muted: unmute(shape.muted, to.string),
  };
}

export function removeDot(shape: ChordShape, string: number): ChordShape {
  return { ...shape, dots: withoutString(shape, string) };
}

const sameBarre = (d: FretDot, ref: FretDot) => d.finger === ref.finger && d.fret === ref.fret;
const barreStrings = (shape: ChordShape, ref: FretDot) => shape.dots.filter((d) => sameBarre(d, ref)).map((d) => d.string);
const farthestFrom = (strings: number[], from: number) =>
  strings.reduce((best, s) => (Math.abs(s - from) > Math.abs(best - from) ? s : best), from);
const span = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/**
 * Stretch the finger on `anchor` into a barre reaching string `to`, at the anchor's fret.
 * The far end of any existing barre stays fixed, so dragging an end grows or shrinks it.
 * Strings in range fretted higher keep their own finger (like the F shape); lower or
 * same-fret dots and mutes are replaced by the barre.
 */
export function barreTo(shape: ChordShape, anchor: number, to: number): ChordShape {
  const ref = dotOn(shape, anchor);
  if (!ref || to < 0 || to >= STRING_COUNT) return shape;
  const fixed = farthestFrom(barreStrings(shape, ref), anchor);
  const [lo, hi] = [Math.min(fixed, to), Math.max(fixed, to)];
  const inRange = (s: number) => s >= lo && s <= hi;
  const kept = shape.dots.filter((d) => (inRange(d.string) ? d.fret > ref.fret : !sameBarre(d, ref)));
  const added = span(lo, hi)
    .filter((s) => !kept.some((d) => d.string === s))
    .map((s) => ({ string: s, fret: ref.fret, finger: ref.finger }));
  return { dots: [...kept, ...added].sort((a, b) => a.string - b.string), muted: shape.muted.filter((s) => !inRange(s)) };
}

/** Grow the barre that `string` belongs to by one string in direction `dir` (+1 toward high E). */
export function extendBarre(shape: ChordShape, string: number, dir: 1 | -1): ChordShape {
  const ref = dotOn(shape, string);
  if (!ref) return shape;
  const members = barreStrings(shape, ref);
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
