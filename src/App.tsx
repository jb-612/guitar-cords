import { useCallback, useEffect, useState } from 'react';
import { LibrarySheet } from './library/LibrarySheet';
import { useLibrary, type LibraryApi } from './library/useLibrary';
import { Sheet } from './components/Sheet';
import { ChordEditor, type SavedChord } from './editor/ChordEditor';
import { Transport } from './player/Transport';
import { usePlayer } from './player/usePlayer';
import { BarMenu } from './song/BarMenu';
import { ChordPicker } from './song/ChordPicker';
import { HitSheet } from './song/HitSheet';
import { barUnits } from './song/rhythm';
import { SongScreen } from './song/SongScreen';
import { SongSetup } from './song/SongSetup';
import { TransposeSheet } from './song/TransposeSheet';
import {
  addChord,
  barTimeSignature,
  deleteBar,
  duplicateBar,
  moveBar,
  moveHit,
  replaceHit,
  sameVoicingCount,
  fillRest,
  findEvent,
  insertBar,
  removeEvent,
  repeatHit,
  replaceVoicing,
  setHitStyle,
  setLength,
  setTempoFrom,
  setTimeSignatureFrom,
  type ChordChoice,
  type ChordHit,
  type Song,
} from './song/song';
import { useMyChords } from './song/useMyChords';
import './App.css';

/** What is open on top of the song. */
type Overlay =
  | { kind: 'none' }
  /** Picking a chord: appended, or into a specific rest. */
  | { kind: 'picker'; restId?: string }
  /** Chord editor: a new chord (appended or into a rest), or a new fingering for an existing hit. */
  | { kind: 'editor'; hitId?: string; restId?: string }
  | { kind: 'hit'; id: string }
  | { kind: 'bar'; index: number }
  | { kind: 'setup' }
  | { kind: 'library' }
  | { kind: 'transpose' };

type Apply = (fn: (s: Song) => Song, keepOpen?: boolean) => void;

const UNDO_KEYS: Record<string, 'undo' | 'redo'> = { z: 'undo', 'shift+z': 'redo', y: 'redo' };

function undoCommand(e: KeyboardEvent): 'undo' | 'redo' | null {
  if (!(e.metaKey || e.ctrlKey)) return null;
  return UNDO_KEYS[`${e.shiftKey ? 'shift+' : ''}${e.key.toLowerCase()}`] ?? null;
}

/** Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z or Ctrl+Y redo — anywhere in the app. */
function useUndoKeys(library: LibraryApi) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const command = undoCommand(e);
      if (!command) return;
      e.preventDefault();
      library[command]();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [library]);
}

export function App() {
  const library = useLibrary();
  const { song, update: setSong } = library;
  useUndoKeys(library);
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const { myChords, remember } = useMyChords();
  const player = usePlayer(song);
  const close = useCallback(() => setOverlay({ kind: 'none' }), []);
  const apply: Apply = (fn, keepOpen = false) => {
    setSong(fn);
    if (!keepOpen) close();
  };

  return (
    <div className="app">
      <header className="app-bar">
        <span className="brand">Guitar Cords</span>
        <nav className="app-actions" aria-label="Song actions">
          <button type="button" className="new-song-btn" onClick={() => setOverlay({ kind: 'library' })}>
            My songs
          </button>
          <button type="button" className="icon-btn small" aria-label="Undo" title="Undo (Ctrl/⌘+Z)" disabled={!library.canUndo} onClick={library.undo}>
            ↶
          </button>
          <button type="button" className="icon-btn small" aria-label="Redo" title="Redo (Shift+Ctrl/⌘+Z)" disabled={!library.canRedo} onClick={library.redo}>
            ↷
          </button>
          <button type="button" className="new-song-btn" onClick={() => setOverlay({ kind: 'setup' })}>
            New song
          </button>
        </nav>
      </header>
      <SongScreen
        song={song}
        update={setSong}
        player={player}
        onAddChord={() => setOverlay({ kind: 'picker' })}
        onRestTap={(restId) => setOverlay({ kind: 'picker', restId })}
        onHitTap={(id) => setOverlay({ kind: 'hit', id })}
        onBarMenu={(index) => setOverlay({ kind: 'bar', index })}
        onMoveHit={(from, to, copy) => setSong((s) => moveHit(s, from, to, { copy }))}
        onMoveBar={(from, to) => setSong((s) => moveBar(s, from, to))}
        onTranspose={() => setOverlay({ kind: 'transpose' })}
      />
      <Transport song={song} player={player} />
      <OverlayView overlay={overlay} song={song} myChords={myChords} remember={remember} setOverlay={setOverlay} close={close} apply={apply} library={library} />
    </div>
  );
}

interface OverlayProps {
  overlay: Overlay;
  song: Song;
  myChords: ChordChoice[];
  remember: (c: ChordChoice) => void;
  setOverlay: (o: Overlay) => void;
  close: () => void;
  apply: Apply;
  library: LibraryApi;
}

type OverlayRenderers = { [K in Overlay['kind']]: (props: OverlayProps, overlay: Extract<Overlay, { kind: K }>) => React.ReactNode };

const OVERLAYS: OverlayRenderers = {
  none: () => null,
  picker: (p, o) => <PickerSheet {...p} restId={o.restId} />,
  editor: (p, o) => <EditorSheet {...p} hitId={o.hitId} restId={o.restId} />,
  hit: (p, o) => <HitOptions {...p} id={o.id} />,
  bar: (p, o) => <BarOptions {...p} index={o.index} />,
  setup: (p) => <SetupSheet {...p} />,
  library: (p) => <LibraryOverlay {...p} />,
  transpose: (p) => (
    <Sheet label="Transpose & key" onClose={p.close}>
      <TransposeSheet song={p.song} onApply={(next) => p.apply(() => next)} onClose={p.close} />
    </Sheet>
  ),
};

function OverlayView(props: OverlayProps) {
  const render = OVERLAYS[props.overlay.kind] as (p: OverlayProps, o: Overlay) => React.ReactNode;
  return render(props, props.overlay);
}

/** Put a chosen chord where the creator asked: into a rest, or at the end of the song. */
const placeChord = (choice: ChordChoice, restId?: string, units?: number) => (s: Song) =>
  restId ? fillRest(s, restId, choice, units) : addChord(s, choice, units);

function PickerSheet({ song, myChords, setOverlay, close, apply, restId }: OverlayProps & { restId?: string }) {
  return (
    <Sheet label="Add a chord" onClose={close}>
      <ChordPicker
        songKey={song.key}
        myChords={myChords}
        onPick={(choice, units) => apply(placeChord(choice, restId, units))}
        onCreate={() => setOverlay({ kind: 'editor', restId })}
        onClose={close}
      />
    </Sheet>
  );
}

const hitById = (song: Song, id?: string) => {
  const at = id ? findEvent(song, id) : null;
  return at?.event.kind === 'chord' ? at.event : undefined;
};

/** Editing keeps the hit's own name (it may be custom); a new chord starts empty in the song key. */
function editorStart(song: Song, existing?: ChordHit) {
  const key = song.key ?? '';
  if (!existing) return { title: 'New chord', shape: undefined, name: null, key };
  return { title: `Edit ${existing.symbol}`, shape: existing.shape, name: existing.symbol, key };
}

/** Editing changes just this hit (a bass walk: G -> G/F#), or every hit with the same fingering. */
const editExisting = (id: string, choice: ChordChoice, everywhere: boolean) => (s: Song) =>
  everywhere ? replaceVoicing(s, id, choice) : replaceHit(s, id, choice);

function AlsoUpdate({ song, hit, checked, onChange }: { song: Song; hit: ChordHit; checked: boolean; onChange: (v: boolean) => void }) {
  const others = sameVoicingCount(song, hit.id);
  if (others === 0) return null;
  return (
    <label className="also-update">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Also update the {others} other {hit.symbol} {others === 1 ? 'hit' : 'hits'} with this fingering
    </label>
  );
}

function EditorSheet({ song, close, apply, remember, hitId, restId }: OverlayProps & { hitId?: string; restId?: string }) {
  const existing = hitById(song, hitId);
  const start = editorStart(song, existing);
  const [everywhere, setEverywhere] = useState(false);
  const save = ({ name, shape }: SavedChord) => {
    const choice = { symbol: name, shape };
    remember(choice);
    apply(existing ? editExisting(existing.id, choice, everywhere) : placeChord(choice, restId));
  };
  return (
    <Sheet label={start.title} onClose={close} wide>
      <h2 className="sheet-title editor-sheet-title">{start.title}</h2>
      {existing && <AlsoUpdate song={song} hit={existing} checked={everywhere} onChange={setEverywhere} />}
      <ChordEditor initialShape={start.shape} initialName={start.name} initialKey={start.key} onSave={save} onCancel={close} />
    </Sheet>
  );
}

function HitOptions({ song, setOverlay, close, apply, id }: OverlayProps & { id: string }) {
  const at = findEvent(song, id);
  if (at?.event.kind !== 'chord') return null;
  const hit: ChordHit = at.event;
  const room = barUnits(barTimeSignature(song, at.barIndex)) - at.start;
  return (
    <Sheet label={`${hit.symbol} chord options`} onClose={close}>
      <HitSheet
        hit={hit}
        room={room}
        onLength={(units) => apply((s) => setLength(s, id, units), true)}
        onStyle={(style) => apply((s) => setHitStyle(s, id, style), true)}
        onRepeat={() => apply((s) => repeatHit(s, id), true)}
        onEdit={() => setOverlay({ kind: 'editor', hitId: id })}
        onDelete={() => apply((s) => removeEvent(s, id))}
        onClose={close}
      />
    </Sheet>
  );
}

function BarOptions({ song, close, apply, index }: OverlayProps & { index: number }) {
  return (
    <Sheet label={`Bar ${index + 1}`} onClose={close}>
      <BarMenu
        song={song}
        index={index}
        onTimeSignature={(ts) => apply((s) => setTimeSignatureFrom(s, index, ts), true)}
        onTempo={(bpm) => apply((s) => setTempoFrom(s, index, bpm), true)}
        onInsert={(where) => apply((s) => insertBar(s, where === 'before' ? index : index + 1))}
        onDuplicate={() => apply((s) => duplicateBar(s, index))}
        onMove={(to) => apply((s) => moveBar(s, index, to))}
        onDelete={() => apply((s) => deleteBar(s, index))}
        onClose={close}
      />
    </Sheet>
  );
}

function SetupSheet({ close, library }: OverlayProps) {
  return (
    <Sheet label="New song" onClose={close}>
      <SongSetup
        onCreate={(setup) => {
          library.create(setup);
          close();
        }}
        onClose={close}
      />
    </Sheet>
  );
}

function LibraryOverlay({ close, setOverlay, library }: OverlayProps) {
  return (
    <Sheet label="My songs" onClose={close}>
      <LibrarySheet
        songs={library.songs}
        currentId={library.lib.currentId}
        onOpen={(id) => {
          library.open(id);
          close();
        }}
        onRename={library.rename}
        onDuplicate={library.duplicate}
        onDelete={library.remove}
        onNew={() => setOverlay({ kind: 'setup' })}
        onClose={close}
      />
    </Sheet>
  );
}
