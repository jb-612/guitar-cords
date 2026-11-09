/**
 * Undo/redo history. Changes tagged the same way (e.g. typing in one field) within
 * MERGE_MS of each other become a single step.
 */

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  lastTag?: string;
  lastAt: number;
}

const LIMIT = 100;
const MERGE_MS = 800;

export const startHistory = <T>(present: T): History<T> => ({ past: [], present, future: [], lastAt: -Infinity });

const merges = <T>(h: History<T>, tag: string | undefined, at: number) => tag !== undefined && tag === h.lastTag && at - h.lastAt < MERGE_MS;

export function push<T>(h: History<T>, next: T, opts: { tag?: string; at: number }): History<T> {
  const past = merges(h, opts.tag, opts.at) ? h.past : [...h.past, h.present].slice(-LIMIT);
  return { past, present: next, future: [], lastTag: opts.tag, lastAt: opts.at };
}

export function undo<T>(h: History<T>): History<T> {
  const previous = h.past[h.past.length - 1];
  if (h.past.length === 0) return h;
  return { past: h.past.slice(0, -1), present: previous as T, future: [h.present, ...h.future], lastAt: -Infinity };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  const [next, ...future] = h.future;
  return { past: [...h.past, h.present], present: next as T, future, lastAt: -Infinity };
}

export const canUndo = <T>(h: History<T>) => h.past.length > 0;
export const canRedo = <T>(h: History<T>) => h.future.length > 0;
