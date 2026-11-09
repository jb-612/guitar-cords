/**
 * Current song, autosaved to this device's localStorage. Temporary until the
 * Firebase sync milestone; storage failures (private mode, quota) never break the app.
 */
import { useEffect, useState } from 'react';
import { createSong, migrateSong, type Song } from './song';

const STORAGE_KEY = 'guitar-cords:current-song';

/** The saved song, upgraded from older versions; a new song if there is none (or it can't be read). */
function load(): Song {
  try {
    return migrateSong(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')) ?? createSong();
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
