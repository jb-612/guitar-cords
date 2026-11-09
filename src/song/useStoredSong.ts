/**
 * Current song, autosaved to this device's localStorage. Temporary until the
 * Firebase sync milestone; storage failures (private mode, quota) never break the app.
 */
import { useEffect, useState } from 'react';
import { createSong, type Song } from './song';

const STORAGE_KEY = 'guitar-cords:current-song';

const isSong = (v: unknown): v is Song =>
  typeof v === 'object' && v !== null && Array.isArray((v as Song).bars) && typeof (v as Song).title === 'string';

function load(): Song {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return isSong(parsed) ? parsed : createSong();
  } catch {
    return createSong();
  }
}

export function useStoredSong() {
  const [song, setSong] = useState<Song>(load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(song));
    } catch {
      // Storage unavailable: keep working in memory.
    }
  }, [song]);
  return [song, setSong] as const;
}
