/**
 * Pointer gestures on finger dots:
 * - press + move quickly  -> "move": drop the dot on the cell under the pointer
 * - press + hold (HOLD_MS) -> "stretch": drag across strings to make a barre
 * - press + release        -> tap (select, or remove if already selected)
 * The pointer is captured on the diagram, so the browser's click lands on the svg
 * rather than the dot: taps are handled here on pointer-up and that click is swallowed.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { ChordShape } from '../music/chordShape';
import { nearestString, pointToCell } from './diagramGeometry';
import type { EditorAction } from './editorReducer';

const DRAG_THRESHOLD = 6;
export const HOLD_MS = 380;
const HOLD_BUZZ_MS = 12;

export type DragMode = 'pressing' | 'move' | 'stretch';

export interface DragState {
  from: number;
  /** Fret of the pressed dot, for taps. */
  fret: number;
  x: number;
  y: number;
  mode: DragMode;
  /** Shape when the stretch began; every stretch step is computed from it. */
  base?: ChordShape;
}

function toSvgPoint(svg: SVGSVGElement, e: PointerEvent): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM?.();
  if (!ctm) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

const pointIn = (svgRef: RefObject<SVGSVGElement | null>, e: PointerEvent) => (svgRef.current ? toSvgPoint(svgRef.current, e) : null);

/** Keep receiving this pointer's events while it moves off the dot (some pointers can't be captured). */
function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture?.(pointerId);
  } catch {
    // Not capturable (e.g. synthetic or already released): window listeners still follow it.
  }
}

const movedFar = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) > DRAG_THRESHOLD;

interface Options {
  svgRef: RefObject<SVGSVGElement | null>;
  shape: ChordShape;
  startFret: number;
  dispatch: (a: EditorAction) => void;
}

export function useDotDrag({ svgRef, shape, startFret, dispatch }: Options) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const swallowClick = useRef(false);
  const shapeRef = useRef(shape);
  useEffect(() => {
    shapeRef.current = shape;
  }, [shape]);
  useEffect(() => () => clearTimeout(holdTimer.current), []);

  const startStretch = useCallback(
    (string: number) => {
      setDrag((d) => (d && d.mode === 'pressing' ? { ...d, mode: 'stretch', base: shapeRef.current } : d));
      dispatch({ type: 'select', string });
      navigator.vibrate?.(HOLD_BUZZ_MS);
    },
    [dispatch],
  );

  const onDotPointerDown = useCallback(
    (e: PointerEvent, dot: { string: number; fret: number }) => {
      const p = svgRef.current && toSvgPoint(svgRef.current, e);
      if (!p) return;
      capture(svgRef.current!, e.pointerId);
      origin.current = p;
      setDrag({ from: dot.string, fret: dot.fret, ...p, mode: 'pressing' });
      clearTimeout(holdTimer.current);
      holdTimer.current = setTimeout(() => startStretch(dot.string), HOLD_MS);
    },
    [svgRef, startStretch],
  );

  const follow = (drag: DragState, p: { x: number; y: number }) => {
    const next = followPointer(drag, p, origin.current);
    if (next.mode === 'move') clearTimeout(holdTimer.current);
    setDrag(next);
  };

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const p = drag ? pointIn(svgRef, e) : null;
      if (!drag || !p) return;
      if (drag.mode === 'stretch') {
        dispatch({ type: 'barre', base: drag.base!, anchor: drag.from, to: nearestString(p.x) });
      } else {
        follow(drag, p);
      }
    },
    [drag, svgRef, dispatch],
  );

  const onPointerUp = useCallback(() => {
    clearTimeout(holdTimer.current);
    if (drag) finishPress(drag, startFret, dispatch);
    swallowClick.current = drag !== null;
    setDrag(null);
  }, [drag, startFret, dispatch]);

  /** Returns true (and resets) if the current click is the tail of a move or stretch. */
  const consumeDragClick = useCallback(() => {
    const swallow = swallowClick.current;
    swallowClick.current = false;
    return swallow;
  }, []);

  return { drag, onDotPointerDown, onPointerMove, onPointerUp, consumeDragClick };
}

/** A press turns into a move once the pointer travels past the threshold, and stays one. */
function followPointer(drag: DragState, p: { x: number; y: number }, origin: { x: number; y: number }): DragState {
  const mode = drag.mode === 'move' || movedFar(p, origin) ? 'move' : 'pressing';
  return { ...drag, ...p, mode };
}

/** End of a press on a dot: a move drops it, a plain press is a tap, a stretch is already applied. */
function finishPress(drag: DragState, startFret: number, dispatch: (a: EditorAction) => void) {
  if (drag.mode === 'move') dropAt(drag, startFret, dispatch);
  if (drag.mode === 'pressing') dispatch({ type: 'cell', string: drag.from, fret: drag.fret });
}

function dropAt(drag: DragState, startFret: number, dispatch: (a: EditorAction) => void) {
  const hit = pointToCell(drag, startFret);
  if (hit && 'fret' in hit) dispatch({ type: 'drop', from: drag.from, string: hit.string, fret: hit.fret });
}
