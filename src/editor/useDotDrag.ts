/**
 * Pointer dragging for finger dots. A press that moves less than DRAG_THRESHOLD
 * stays a tap (handled by the click handlers); a real drag drops the dot on the
 * cell under the pointer and swallows the click that follows.
 */
import { useCallback, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { pointToCell } from './diagramGeometry';
import type { EditorAction } from './editorReducer';

const DRAG_THRESHOLD = 6;

export interface DragState {
  from: number;
  x: number;
  y: number;
  moved: boolean;
}

function toSvgPoint(svg: SVGSVGElement, e: PointerEvent): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

export function useDotDrag(svgRef: RefObject<SVGSVGElement | null>, startFret: number, dispatch: (a: EditorAction) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const swallowClick = useRef(false);

  const onDotPointerDown = useCallback((e: PointerEvent, string: number) => {
    const p = svgRef.current && toSvgPoint(svgRef.current, e);
    if (!p) return;
    svgRef.current!.setPointerCapture?.(e.pointerId);
    origin.current = p;
    setDrag({ from: string, ...p, moved: false });
  }, [svgRef]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const p = drag && svgRef.current && toSvgPoint(svgRef.current, e);
    if (!p) return;
    const moved = drag.moved || Math.hypot(p.x - origin.current.x, p.y - origin.current.y) > DRAG_THRESHOLD;
    setDrag({ ...drag, ...p, moved });
  }, [drag, svgRef]);

  const onPointerUp = useCallback(() => {
    if (drag?.moved) {
      const hit = pointToCell(drag, startFret);
      if (hit && 'fret' in hit) dispatch({ type: 'drop', from: drag.from, string: hit.string, fret: hit.fret });
      swallowClick.current = true;
    }
    setDrag(null);
  }, [drag, startFret, dispatch]);

  /** Returns true (and resets) if the current click is the tail of a drag. */
  const consumeDragClick = useCallback(() => {
    const swallow = swallowClick.current;
    swallowClick.current = false;
    return swallow;
  }, []);

  return { drag, onDotPointerDown, onPointerMove, onPointerUp, consumeDragClick };
}
