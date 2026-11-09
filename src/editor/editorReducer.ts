/**
 * Chord-editor interaction state. Wraps the pure chordShape operations with
 * selection and the visible fret window.
 */
import {
  EMPTY_SHAPE,
  VISIBLE_FRETS,
  moveDot,
  barreTo,
  extendBarre,
  removeDot,
  setFinger,
  tapString,
  toggleMute,
  viewStartFret,
  type ChordShape,
  type Finger,
} from '../music/chordShape';

export const MAX_START_FRET = 15;

export interface EditorState {
  shape: ChordShape;
  /** First fret shown in the diagram (1 = nut). */
  startFret: number;
  /** String index of the selected dot. */
  selected: number | null;
}

export type EditorAction =
  | { type: 'cell'; string: number; fret: number }
  | { type: 'nut'; string: number }
  | { type: 'finger'; finger: Finger }
  | { type: 'remove' }
  | { type: 'nudge'; dString: number; dFret: number }
  | { type: 'drop'; from: number; string: number; fret: number }
  | { type: 'window'; delta: number }
  /** Live barre stretch: always computed from `base`, the shape when the hold began. */
  | { type: 'barre'; base: ChordShape; anchor: number; to: number }
  | { type: 'extend'; dir: 1 | -1 }
  | { type: 'select'; string: number | null }
  | { type: 'load'; shape: ChordShape }
  | { type: 'clear' };

export const initialEditorState: EditorState = { shape: EMPTY_SHAPE, startFret: 1, selected: null };

const clampStart = (f: number) => Math.min(MAX_START_FRET, Math.max(1, f));

/** Scroll the window just enough to show `fret`. */
function follow(startFret: number, fret: number): number {
  if (fret < startFret) return clampStart(fret);
  if (fret >= startFret + VISIBLE_FRETS) return clampStart(fret - VISIBLE_FRETS + 1);
  return startFret;
}

function onCell(state: EditorState, string: number, fret: number): EditorState {
  const dot = state.shape.dots.find((d) => d.string === string);
  if (dot?.fret === fret && state.selected !== string) return { ...state, selected: string };
  const shape = tapString(state.shape, string, fret);
  const placed = shape.dots.some((d) => d.string === string);
  return { ...state, shape, selected: placed ? string : null };
}

function onMove(state: EditorState, from: number, to: { string: number; fret: number }): EditorState {
  const shape = moveDot(state.shape, from, to);
  if (shape === state.shape) return state;
  return { shape, selected: to.string, startFret: follow(state.startFret, to.fret) };
}

function onNudge(state: EditorState, dString: number, dFret: number): EditorState {
  const dot = state.shape.dots.find((d) => d.string === state.selected);
  if (!dot) return state;
  return onMove(state, dot.string, { string: dot.string + dString, fret: dot.fret + dFret });
}

const withoutSelection = (state: EditorState, shape: ChordShape): EditorState => ({ ...state, shape, selected: null });

type Handlers = { [K in EditorAction['type']]: (state: EditorState, action: Extract<EditorAction, { type: K }>) => EditorState };

const handlers: Handlers = {
  cell: (s, a) => onCell(s, a.string, a.fret),
  nut: (s, a) => withoutSelection(s, toggleMute(s.shape, a.string)),
  finger: (s, a) => (s.selected === null ? s : { ...s, shape: setFinger(s.shape, s.selected, a.finger) }),
  remove: (s) => (s.selected === null ? s : withoutSelection(s, removeDot(s.shape, s.selected))),
  nudge: (s, a) => onNudge(s, a.dString, a.dFret),
  drop: (s, a) => onMove(s, a.from, a),
  window: (s, a) => ({ ...s, startFret: clampStart(s.startFret + a.delta) }),
  barre: (s, a) => ({ ...s, shape: barreTo(a.base, a.anchor, a.to), selected: a.anchor }),
  extend: (s, a) => (s.selected === null ? s : { ...s, shape: extendBarre(s.shape, s.selected, a.dir) }),
  select: (s, a) => ({ ...s, selected: a.string }),
  load: (_, a) => ({ shape: a.shape, startFret: viewStartFret(a.shape), selected: null }),
  clear: () => initialEditorState,
};

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const handle = handlers[action.type] as (s: EditorState, a: EditorAction) => EditorState;
  return handle(state, action);
}
