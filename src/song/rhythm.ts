/**
 * Rhythm arithmetic. Lengths are stored in units of a 1/32 note, so any bar in any
 * time signature divides exactly; notation (dotted / tied note values) is derived
 * only when exporting.
 */

export const UNITS_PER_WHOLE = 32;

export type NoteValue = 1 | 2 | 4 | 8 | 16 | 32;
export const NOTE_VALUES: NoteValue[] = [1, 2, 4, 8, 16, 32];

export interface TimeSignature {
  beats: number;
  unit: 2 | 4 | 8 | 16;
}

export const COMMON_TIME_SIGNATURES: TimeSignature[] = [
  { beats: 4, unit: 4 },
  { beats: 3, unit: 4 },
  { beats: 2, unit: 4 },
  { beats: 5, unit: 4 },
  { beats: 6, unit: 8 },
  { beats: 7, unit: 8 },
  { beats: 9, unit: 8 },
  { beats: 12, unit: 8 },
];

export const unitsOf = (value: NoteValue, dotted = false) => (UNITS_PER_WHOLE / value) * (dotted ? 1.5 : 1);

export const barUnits = (ts: TimeSignature) => (ts.beats * UNITS_PER_WHOLE) / ts.unit;

export const sameTimeSignature = (a: TimeSignature, b: TimeSignature) => a.beats === b.beats && a.unit === b.unit;

export const formatTimeSignature = (ts: TimeSignature) => `${ts.beats}/${ts.unit}`;

export interface NotePart {
  value: NoteValue;
  dotted: boolean;
}

/** Largest note (dotted first) that fits in `units`. A dotted 1/32 is not a whole unit, so it is never used. */
function largestPart(units: number): NotePart {
  for (const value of NOTE_VALUES) {
    if (value < 32 && unitsOf(value, true) <= units) return { value, dotted: true };
    if (unitsOf(value) <= units) return { value, dotted: false };
  }
  return { value: 32, dotted: false };
}

/** Notation for a length: one note when possible (dotted if needed), otherwise notes to tie together. */
export function splitUnits(units: number): NotePart[] {
  const parts: NotePart[] = [];
  for (let left = units; left > 0; ) {
    const part = largestPart(left);
    parts.push(part);
    left -= unitsOf(part.value, part.dotted);
  }
  return parts;
}

/** Natural strum direction for a hit starting `start` units into the bar: down on a quarter-note beat, up off it. */
export const defaultDirection = (start: number): 'down' | 'up' => (start % unitsOf(4) === 0 ? 'down' : 'up');

const VALUE_NAMES: Record<NoteValue, string> = { 1: 'whole', 2: 'half', 4: 'quarter', 8: 'eighth', 16: 'sixteenth', 32: 'thirty-second' };

export const partName = (p: NotePart) => `${p.dotted ? 'dotted ' : ''}${VALUE_NAMES[p.value]}`;

/** Spoken/visible name of a length: "quarter", "dotted half", "whole + quarter". */
export const lengthName = (units: number) => splitUnits(units).map(partName).join(' + ');

const VALUE_SHORT: Record<NoteValue, string> = { 1: '1', 2: '½', 4: '¼', 8: '⅛', 16: '1/16', 32: '1/32' };

/** Compact length label: "¼", "½." (dotted), "1+¼" (tied). */
export const shortLength = (units: number) =>
  splitUnits(units)
    .map((p) => `${VALUE_SHORT[p.value]}${p.dotted ? '.' : ''}`)
    .join('+');

/** Lengths offered when adding a chord or notes; null = fill the available space. */
export const LENGTH_CHOICES: [string, number | null][] = [
  ['Fill', null],
  ['Whole', unitsOf(1)],
  ['Half', unitsOf(2)],
  ['Quarter', unitsOf(4)],
  ['Eighth', unitsOf(8)],
  ['Sixteenth', unitsOf(16)],
];
