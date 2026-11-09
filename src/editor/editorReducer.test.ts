import { editorReducer, initialEditorState, type EditorAction, type EditorState } from './editorReducer';
import { shapeFromFrets } from '../music/chordShape';

const run = (actions: EditorAction[], start: EditorState = initialEditorState) => actions.reduce(editorReducer, start);

describe('editorReducer', () => {
  it('places a dot on an empty cell and selects it', () => {
    const s = run([{ type: 'cell', string: 1, fret: 3 }]);
    expect(s.shape.dots).toEqual([{ string: 1, fret: 3, finger: 1 }]);
    expect(s.selected).toBe(1);
  });

  it('tapping an unselected dot selects it without changing the shape', () => {
    const placed = run([{ type: 'cell', string: 1, fret: 3 }, { type: 'cell', string: 2, fret: 2 }]);
    const s = editorReducer(placed, { type: 'cell', string: 1, fret: 3 });
    expect(s.shape).toBe(placed.shape);
    expect(s.selected).toBe(1);
  });

  it('tapping the selected dot removes it', () => {
    const s = run([{ type: 'cell', string: 1, fret: 3 }, { type: 'cell', string: 1, fret: 3 }]);
    expect(s.shape.dots).toEqual([]);
    expect(s.selected).toBeNull();
  });

  it('tapping another fret on a string with a dot moves that dot', () => {
    const s = run([{ type: 'cell', string: 1, fret: 3 }, { type: 'cell', string: 1, fret: 5 }]);
    expect(s.shape.dots).toEqual([{ string: 1, fret: 5, finger: 1 }]);
  });

  it('sets the finger of the selected dot, including thumb', () => {
    const s = run([{ type: 'cell', string: 0, fret: 3 }, { type: 'finger', finger: 0 }]);
    expect(s.shape.dots[0]?.finger).toBe(0);
  });

  it('removes the selected dot', () => {
    const s = run([{ type: 'cell', string: 0, fret: 3 }, { type: 'remove' }]);
    expect(s.shape.dots).toEqual([]);
    expect(s.selected).toBeNull();
  });

  it('nudges the selected dot across strings and frets and keeps it selected', () => {
    const s = run([{ type: 'cell', string: 1, fret: 3 }, { type: 'nudge', dString: 1, dFret: 1 }]);
    expect(s.shape.dots).toEqual([{ string: 2, fret: 4, finger: 1 }]);
    expect(s.selected).toBe(2);
  });

  it('does not nudge onto a string that already has a dot', () => {
    const before = run([{ type: 'cell', string: 2, fret: 2 }, { type: 'cell', string: 1, fret: 3 }]);
    expect(editorReducer(before, { type: 'nudge', dString: 1, dFret: 0 }).shape).toBe(before.shape);
  });

  it('scrolls the fret window to follow a dot nudged past its edge', () => {
    const s = run([{ type: 'cell', string: 1, fret: 5 }, { type: 'nudge', dString: 0, dFret: 1 }]);
    expect(s.startFret).toBe(2);
  });

  it('drops a dragged dot on a new cell', () => {
    const s = run([{ type: 'cell', string: 1, fret: 3 }, { type: 'drop', from: 1, string: 4, fret: 1 }]);
    expect(s.shape.dots).toEqual([{ string: 4, fret: 1, finger: 1 }]);
    expect(s.selected).toBe(4);
  });

  it('moves the fret window up and down the neck, never above the nut', () => {
    expect(run([{ type: 'window', delta: 3 }]).startFret).toBe(4);
    expect(run([{ type: 'window', delta: -3 }]).startFret).toBe(1);
  });

  it('toggles a string open/muted above the nut and clears its selection', () => {
    const s = run([{ type: 'cell', string: 0, fret: 3 }, { type: 'nut', string: 0 }]);
    expect(s.shape.muted).toEqual([0]);
    expect(s.shape.dots).toEqual([]);
    expect(s.selected).toBeNull();
  });

  it('loads a shape and positions the window on it', () => {
    const s = run([{ type: 'load', shape: shapeFromFrets('x-10-12-12-12-10') }]);
    expect(s.startFret).toBe(10);
    expect(s.selected).toBeNull();
  });

  it('stretches a barre from a snapshot of the shape at the start of the hold', () => {
    const placed = run([{ type: 'cell', string: 0, fret: 1 }]);
    const base = placed.shape;
    const wide = editorReducer(placed, { type: 'barre', base, anchor: 0, to: 5 });
    const back = editorReducer(wide, { type: 'barre', base, anchor: 0, to: 2 });
    expect(back.shape.dots.map((d) => d.string)).toEqual([0, 1, 2]);
    expect(back.selected).toBe(0);
  });

  it('extends the selected finger into a barre one string at a time', () => {
    const s = run([{ type: 'cell', string: 1, fret: 3 }, { type: 'extend', dir: 1 }, { type: 'extend', dir: 1 }]);
    expect(s.shape.dots.filter((d) => d.finger === 1).map((d) => d.string).sort()).toEqual([1, 2, 3]);
  });

  it('clears everything', () => {
    const s = run([{ type: 'cell', string: 0, fret: 3 }, { type: 'window', delta: 2 }, { type: 'clear' }]);
    expect(s).toEqual(initialEditorState);
  });

  it('records why a move was refused, until the next action', () => {
    const blocked = run([{ type: 'cell', string: 2, fret: 2 }, { type: 'cell', string: 1, fret: 3 }, { type: 'nudge', dString: 1, dFret: 0 }]);
    expect(blocked.refusal).toBe('occupied');
    expect(editorReducer(blocked, { type: 'window', delta: 1 }).refusal).toBeNull();
  });
});
