/**
 * The library in React: all songs (saved on this device), the open song with its own
 * undo/redo history, and the library actions. Switching songs starts a fresh history.
 */
import { useEffect, useState } from 'react';
import { songFromLink } from '../share/link';
import { createSong, type Song, type SongSetup } from '../song/song';
import { canRedo, canUndo, push, redo, startHistory, undo, type History } from './history';
import { addSong, clearDeleted, currentSong, deleteSong, duplicateSong, migrateLibrary, openSong, putSong, renameSong, updateCurrent, type Library } from './library';

export const LIBRARY_KEY = 'guitar-cords:library';
/** Where versions before the library kept their one song. */
const OLD_SONG_KEY = 'guitar-cords:current-song';

interface State {
  lib: Library;
  history: History<Song>;
  /** Title of a song that arrived in a share link when the app opened. */
  arrived?: string;
}

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

function load(): State {
  const stored = migrateLibrary(read(LIBRARY_KEY), read(OLD_SONG_KEY));
  const shared = songFromLink(window.location.href);
  const lib = shared ? addSong(stored, shared) : stored;
  return { lib, history: startHistory(currentSong(lib)), arrived: shared?.title };
}

/** A library change that may switch the open song: the history restarts on it. */
const withLib = (lib: Library): State => ({ lib, history: startHistory(currentSong(lib)) });

/** Move the open song to `history.present` (after undo/redo or an edit). */
const syncPresent = (s: State, history: History<Song>): State =>
  history === s.history ? s : { history, lib: updateCurrent(s.lib, () => history.present) };

export type UpdateSong = (fn: (s: Song) => Song, tag?: string) => void;

/** Edit the open song as one undoable step. */
function editCurrent(s: State, fn: (song: Song) => Song, tag?: string): State {
  const next = fn(s.history.present);
  return next === s.history.present ? s : syncPresent(s, push(s.history, next, { tag, at: Date.now() }));
}

/** Rename: the open song's rename is an undoable edit; others just change in the list. */
function renameIn(s: State, id: string, title: string): State {
  const clean = title.trim();
  if (id !== s.lib.currentId) return { ...s, lib: renameSong(s.lib, id, clean) };
  return clean ? editCurrent(s, (song) => ({ ...song, title: clean })) : s;
}

export function useLibrary() {
  const [state, setState] = useState<State>(load);

  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(state.lib));
    } catch {
      // Storage unavailable: keep working in memory.
    }
  }, [state.lib]);

  const update: UpdateSong = (fn, tag) => setState((s) => editCurrent(s, fn, tag));

  const libraryAction = (fn: (lib: Library) => Library) => setState((s) => withLib(fn(s.lib)));

  return {
    song: state.history.present,
    arrivedFromLink: state.arrived ?? null,
    songs: state.lib.songs,
    lib: state.lib,
    update,
    undo: () => setState((s) => syncPresent(s, undo(s.history))),
    redo: () => setState((s) => syncPresent(s, redo(s.history))),
    canUndo: canUndo(state.history),
    canRedo: canRedo(state.history),
    open: (id: string) => libraryAction((lib) => openSong(lib, id)),
    create: (setup: SongSetup) => libraryAction((lib) => addSong(lib, createSong(setup))),
    rename: (id: string, title: string) => setState((s) => renameIn(s, id, title)),
    duplicate: (id: string) => libraryAction((lib) => duplicateSong(lib, id)),
    /** Add a song from elsewhere (import, share link) and open it. */
    importSong: (song: Song) => libraryAction((lib) => addSong(lib, song)),
    remove: (id: string) => libraryAction((lib) => deleteSong(lib, id)),
    /** Replace the whole library (sync). Keeps the open song's history if it is unchanged. */
    replaceLibrary: (lib: Library) => setState((s) => (currentSong(lib) === currentSong(s.lib) ? { ...s, lib } : withLib(lib))),
    /** Sync uploaded these deletions. */
    forgetDeleted: (ids: string[]) => setState((s) => ({ ...s, lib: clearDeleted(s.lib, ids) })),
    /** Put one song from elsewhere (sync), without touching history unless it is the open one. */
    putSong: (song: Song) => setState((s) => (song.id === s.lib.currentId ? withLib(putSong(s.lib, song)) : { ...s, lib: putSong(s.lib, song) })),
  };
}

export type LibraryApi = ReturnType<typeof useLibrary>;
