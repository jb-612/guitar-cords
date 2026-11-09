/**
 * Selecting bars (by id, so selections survive edits) and the bar clipboard.
 * The clipboard is kept on this device so bars can be pasted into another song.
 */
import { useEffect, useState } from 'react';
import type { Song } from './song';
import { copyBars, deleteBars, pasteBars, type Clip } from './structure';

const CLIP_KEY = 'guitar-cords:clipboard';

function loadClip(): Clip {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CLIP_KEY) ?? '[]');
    return Array.isArray(raw) ? (raw as Clip) : [];
  } catch {
    return [];
  }
}

const toggled = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

export interface ClickMods {
  shift: boolean;
  toggle: boolean;
}

export function useBarSelection(song: Song, update: (fn: (s: Song) => Song) => void) {
  const [mode, setMode] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [clip, setClip] = useState<Clip>(loadClip);
  useEffect(() => {
    try {
      localStorage.setItem(CLIP_KEY, JSON.stringify(clip));
    } catch {
      // Storage unavailable: clipboard lives in memory.
    }
  }, [clip]);

  const indexOf = (id: string) => song.bars.findIndex((b) => b.id === id);
  const selectedIndexes = () => ids.map(indexOf).filter((i) => i >= 0).sort((a, b) => a - b);
  const range = (a: string, b: string) => {
    const [ia, ib] = [indexOf(a), indexOf(b)];
    return song.bars.slice(Math.min(ia, ib), Math.max(ia, ib) + 1).map((bar) => bar.id);
  };

  /** Shift extends from the last bar clicked; otherwise toggle this bar. */
  const click = (id: string, mods: ClickMods) => {
    setMode(true);
    setIds((cur) => (mods.shift && anchor ? [...new Set([...cur, ...range(anchor, id)])] : toggled(cur, id)));
    setAnchor(id);
  };

  const done = () => {
    setMode(false);
    setIds([]);
    setAnchor(null);
  };

  const copy = () => setClip(copyBars(song, selectedIndexes()));
  const remove = () => {
    const idx = selectedIndexes();
    update((s) => deleteBars(s, idx));
    done();
  };

  return {
    mode,
    ids,
    clipSize: clip.length,
    click,
    start: (id: string) => {
      setMode(true);
      setIds([id]);
      setAnchor(id);
    },
    done,
    copy,
    cut: () => {
      copy();
      remove();
    },
    remove,
    /** Paste after the last selected bar, after bar `at`, or at the end. */
    paste: (at?: number) => {
      const after = at ?? selectedIndexes().at(-1) ?? song.bars.length - 1;
      update((s) => pasteBars(s, after, clip));
    },
  };
}

export type BarSelection = ReturnType<typeof useBarSelection>;
