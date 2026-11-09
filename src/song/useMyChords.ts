/**
 * The creator's own chord fingerings, kept on this device (Firebase sync later).
 * A chord is the same entry when both its name and its frets match.
 */
import { useCallback, useEffect, useState } from 'react';
import { oneDotPerString, toFretString } from '../music/chordShape';
import type { ChordChoice } from './song';

const STORAGE_KEY = 'guitar-cords:my-chords';

const isChoice = (v: unknown): v is ChordChoice =>
  typeof v === 'object' && v !== null && typeof (v as ChordChoice).symbol === 'string' && Array.isArray((v as ChordChoice).shape?.dots);

function load(): ChordChoice[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isChoice).map((c) => ({ ...c, shape: oneDotPerString(c.shape) })) : [];
  } catch {
    return [];
  }
}

const sameChord = (a: ChordChoice, b: ChordChoice) => a.symbol === b.symbol && toFretString(a.shape) === toFretString(b.shape);

/** Newest first; re-saving an existing chord moves it to the front with its latest fingers. */
export function rememberChord(list: ChordChoice[], chord: ChordChoice): ChordChoice[] {
  return [chord, ...list.filter((c) => !sameChord(c, chord))];
}

export function useMyChords() {
  const [chords, setChords] = useState<ChordChoice[]>(load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chords));
    } catch {
      // Storage unavailable: keep in memory.
    }
  }, [chords]);
  const remember = useCallback((chord: ChordChoice) => setChords((list) => rememberChord(list, chord)), []);
  return { myChords: chords, remember, replaceAll: setChords };
}
