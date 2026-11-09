/**
 * Reorder bars by dragging their grip handle. The handle is dedicated, so dragging starts
 * right away for mouse and touch alike. Bars mark themselves with `data-bar-index`; the
 * pointer's half of the bar under it decides whether the drop goes before or after it.
 */
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

const START_PX = 4;

export interface BarDragView {
  from: number;
  x: number;
  y: number;
  /** Bar under the pointer and which side of it the drop goes. */
  target: number | null;
  side: 'before' | 'after';
}

type MoveBar = (from: number, to: number) => void;

function barUnder(x: number, y: number): { target: number | null; side: 'before' | 'after' } {
  const el = document.elementFromPoint?.(x, y)?.closest<HTMLElement>('[data-bar-index]');
  if (!el) return { target: null, side: 'after' };
  const rect = el.getBoundingClientRect();
  return { target: Number(el.dataset.barIndex), side: x < rect.left + rect.width / 2 ? 'before' : 'after' };
}

/** Final position of the moved bar for a drop before/after `target`. */
export function dropPosition(from: number, target: number, side: 'before' | 'after'): number {
  const slot = side === 'before' ? target : target + 1;
  return slot > from ? slot - 1 : slot;
}

function createBarDragController(setView: (v: BarDragView | null) => void) {
  let start: { from: number; x0: number; y0: number; active: boolean } | null = null;
  let onMoveBar: MoveBar = () => {};

  const end = () => {
    start = null;
    setView(null);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', end);
  };

  function onMove(e: PointerEvent) {
    if (!start) return;
    start.active ||= Math.hypot(e.clientX - start.x0, e.clientY - start.y0) > START_PX;
    if (start.active) setView({ from: start.from, x: e.clientX, y: e.clientY, ...barUnder(e.clientX, e.clientY) });
  }

  function onUp(e: PointerEvent) {
    const { target, side } = barUnder(e.clientX, e.clientY);
    if (start?.active && target !== null) {
      const to = dropPosition(start.from, target, side);
      if (to !== start.from) onMoveBar(start.from, to);
    }
    end();
  }

  const begin = (e: ReactPointerEvent, from: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    end();
    start = { from, x0: e.clientX, y0: e.clientY, active: false };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', end);
  };

  const setMove = (fn: MoveBar) => {
    onMoveBar = fn;
  };

  return { begin, end, setMove };
}

export function useBarDrag(onMoveBar: MoveBar) {
  const [view, setView] = useState<BarDragView | null>(null);
  const [controller] = useState(() => createBarDragController(setView));
  useEffect(() => controller.setMove(onMoveBar), [controller, onMoveBar]);
  useEffect(() => controller.end, [controller]);
  return { view, begin: controller.begin };
}
