/**
 * Drag chord hits between slots, in a bar or across bars.
 * - mouse: a drag starts once the pointer moves a few pixels
 * - touch: hold briefly first, so swiping across bars still scrolls the page
 * Slots mark themselves with `data-slot-id`; the slot under the pointer is the target.
 * The click that ends a drag is swallowed so it doesn't open the chord options.
 */
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

const MOUSE_THRESHOLD_PX = 6;
const TOUCH_SCROLL_PX = 10;
const TOUCH_HOLD_MS = 250;

export interface DragView {
  id: string;
  label: string;
  x: number;
  y: number;
  /** Slot id under the pointer, if any. */
  over: string | null;
}

type Drop = (fromId: string, toId: string, copy: boolean) => void;

interface Pending {
  id: string;
  label: string;
  x0: number;
  y0: number;
  touch: boolean;
  active: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

const slotAt = (x: number, y: number) => document.elementFromPoint?.(x, y)?.closest('[data-slot-id]')?.getAttribute('data-slot-id') ?? null;
const far = (p: Pending, e: PointerEvent, px: number) => Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > px;

/** All drag state and window listeners live here, created once, so add/remove always pair up. */
function createDragController(setView: (v: DragView | null) => void) {
  let pending: Pending | null = null;
  let swallowClick = false;
  let drop: Drop = () => {};

  const show = (p: Pending, x: number, y: number) => setView({ id: p.id, label: p.label, x, y, over: slotAt(x, y) });

  const blockScroll = (e: TouchEvent) => {
    if (pending?.active) e.preventDefault();
  };

  const end = () => {
    clearTimeout(pending?.timer);
    pending = null;
    setView(null);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', end);
    window.removeEventListener('touchmove', blockScroll);
  };

  /** Before a drag starts: a mouse that moves starts it; a finger that moves before the hold is a scroll. */
  const startOrCancel = (p: Pending, e: PointerEvent) => {
    if (p.touch && far(p, e, TOUCH_SCROLL_PX)) return end();
    if (!p.touch && far(p, e, MOUSE_THRESHOLD_PX)) {
      p.active = true;
      show(p, e.clientX, e.clientY);
    }
  };

  function onMove(e: PointerEvent) {
    if (!pending) return;
    if (pending.active) show(pending, e.clientX, e.clientY);
    else startOrCancel(pending, e);
  }

  function onUp(e: PointerEvent) {
    if (pending?.active) {
      swallowClick = true;
      const target = slotAt(e.clientX, e.clientY);
      if (target && target !== pending.id) drop(pending.id, target, e.altKey);
    }
    end();
  }

  const holdThenDrag = (p: Pending) =>
    setTimeout(() => {
      p.active = true;
      navigator.vibrate?.(10);
      show(p, p.x0, p.y0);
    }, TOUCH_HOLD_MS);

  const begin = (e: ReactPointerEvent, id: string, label: string) => {
    if (e.button !== 0) return;
    end();
    const p: Pending = { id, label, x0: e.clientX, y0: e.clientY, touch: e.pointerType !== 'mouse', active: false };
    if (p.touch) p.timer = holdThenDrag(p);
    pending = p;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', end);
    window.addEventListener('touchmove', blockScroll, { passive: false });
  };

  /** True (and reset) if the current click is the tail of a drag. */
  const consumeClick = () => {
    const swallow = swallowClick;
    swallowClick = false;
    return swallow;
  };

  const setDrop = (fn: Drop) => {
    drop = fn;
  };

  return { begin, end, consumeClick, setDrop };
}

export function useHitDrag(onDrop: Drop) {
  const [view, setView] = useState<DragView | null>(null);
  const [controller] = useState(() => createDragController(setView));
  useEffect(() => controller.setDrop(onDrop), [controller, onDrop]);
  useEffect(() => controller.end, [controller]);
  return { view, onSlotPointerDown: controller.begin, consumeClick: controller.consumeClick };
}
