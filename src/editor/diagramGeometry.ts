/**
 * Chord-diagram layout in SVG user units. The diagram is vertical, like a printed
 * chord chart: strings run top to bottom with the low E on the left, frets are
 * horizontal, and the nut (or window start) is at the top.
 */
import { STRING_COUNT, VISIBLE_FRETS } from '../music/chordShape';

export const G = {
  left: 40,
  top: 52,
  stringGap: 40,
  fretGap: 50,
  /** Height of the open/mute toggle zone above the nut. */
  nutZone: 44,
  dotRadius: 15,
} as const;

export const BOARD_WIDTH = G.stringGap * (STRING_COUNT - 1);
export const BOARD_HEIGHT = G.fretGap * VISIBLE_FRETS;
export const VIEW_WIDTH = G.left * 2 + BOARD_WIDTH;
export const VIEW_HEIGHT = G.top + BOARD_HEIGHT + 28;

export const stringX = (string: number) => G.left + string * G.stringGap;
/** Y of the fret wire at the bottom of window row `row` (1-based); row 0 = nut line. */
export const fretY = (row: number) => G.top + row * G.fretGap;
/** Centre Y of the cell for window row `row` (1-based), where finger dots sit. */
export const cellCenterY = (row: number) => fretY(row) - G.fretGap / 2;

export type CellHit = { string: number; fret: number } | { string: number; nut: true };

/** Hit-test a point in SVG units against the board for a window starting at `startFret`. */
export function pointToCell(p: { x: number; y: number }, startFret: number): CellHit | null {
  const string = Math.round((p.x - G.left) / G.stringGap);
  const row = Math.ceil((p.y - G.top) / G.fretGap);
  const onBoard = string >= 0 && string < STRING_COUNT && row <= VISIBLE_FRETS;
  return onBoard ? rowHit(string, row, p.y, startFret) : null;
}

function rowHit(string: number, row: number, y: number, startFret: number): CellHit | null {
  if (row > 0) return { string, fret: startFret + row - 1 };
  return y >= G.top - G.nutZone ? { string, nut: true } : null;
}
