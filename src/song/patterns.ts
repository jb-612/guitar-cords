/**
 * Strumming-pattern presets. A pattern re-rhythms a bar; each slot takes the chord
 * that was sounding at its start, so chord changes stay where they were.
 */
import { barUnits, unitsOf, type TimeSignature } from './rhythm';
import { barTimeSignature, type Bar, type ChordHit, type Direction, type PlayStyle, type Song, type SongEvent } from './song';

interface Slot {
  units: number;
  direction: Direction;
  style?: PlayStyle;
}

export interface StrumPattern {
  id: string;
  label: string;
  slots: (ts: TimeSignature) => Slot[];
}

const beat = (ts: TimeSignature) => unitsOf(ts.unit === 8 ? 8 : 4);
const repeat = (n: number, make: (i: number) => Slot) => Array.from({ length: n }, (_, i) => make(i));
const EIGHTH = unitsOf(8);

export const PATTERNS: StrumPattern[] = [
  { id: 'beats', label: 'Down beats ↓ ↓ ↓ ↓', slots: (ts) => repeat(barUnits(ts) / beat(ts), () => ({ units: beat(ts), direction: 'down' })) },
  { id: 'eighths', label: 'Eighths ↓↑ ↓↑', slots: (ts) => repeat(barUnits(ts) / EIGHTH, (i) => ({ units: EIGHTH, direction: i % 2 ? 'up' : 'down' })) },
  {
    id: 'pop',
    label: 'Pop D DU UDU',
    slots: () => [
      { units: EIGHTH * 2, direction: 'down' },
      { units: EIGHTH, direction: 'down' },
      { units: EIGHTH * 2, direction: 'up' },
      { units: EIGHTH, direction: 'up' },
      { units: EIGHTH, direction: 'down' },
      { units: EIGHTH, direction: 'up' },
    ],
  },
  { id: 'arpeggio', label: 'Arpeggio ≀ ≀', slots: (ts) => repeat(2, () => ({ units: barUnits(ts) / 2, direction: 'down', style: 'arpeggio' })) },
];

const FOUR_FOUR_ONLY = new Set(['pop']);

export const patternsFor = (ts: TimeSignature) => PATTERNS.filter((p) => !FOUR_FOUR_ONLY.has(p.id) || (ts.beats === 4 && ts.unit === 4));

/** The hit sounding at `unit` in the bar (the last hit started at or before it). */
function hitAt(events: SongEvent[], unit: number): ChordHit | undefined {
  let start = 0;
  let current: ChordHit | undefined;
  for (const e of events) {
    if (start > unit) break;
    if (e.kind === 'chord') current = e;
    start += e.units;
  }
  return current;
}

function patterned(bar: Bar, slots: Slot[]): SongEvent[] {
  let start = 0;
  return slots.map((slot) => {
    const source = hitAt(bar.events, start) ?? bar.events.find((e): e is ChordHit => e.kind === 'chord')!;
    start += slot.units;
    return { ...source, id: crypto.randomUUID(), units: slot.units, direction: slot.direction, style: slot.style ?? 'strum' };
  });
}

export function applyPattern(song: Song, barIndex: number, patternId: string): Song {
  const bar = song.bars[barIndex];
  const pattern = PATTERNS.find((p) => p.id === patternId);
  if (!bar || !pattern || !bar.events.some((e) => e.kind === 'chord')) return song;
  const events = patterned(bar, pattern.slots(barTimeSignature(song, barIndex)));
  return { ...song, bars: song.bars.map((b, i) => (i === barIndex ? { ...b, events } : b)) };
}
