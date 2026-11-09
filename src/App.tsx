import { useCallback, useState } from 'react';
import { Sheet } from './components/Sheet';
import { ChordEditor, type SavedChord } from './editor/ChordEditor';
import { ChordActions } from './song/ChordActions';
import { ChordPicker } from './song/ChordPicker';
import { SongScreen } from './song/SongScreen';
import { addChord, findChord, removeChord, replaceChord, setChordBeats, type ChordChoice, type Song, type SongChord } from './song/song';
import { useMyChords } from './song/useMyChords';
import { useStoredSong } from './song/useStoredSong';
import './App.css';

/** What is open on top of the song: nothing, the picker, the editor (new or editing a chord), or a chord's options. */
type Overlay =
  | { kind: 'none' }
  | { kind: 'picker' }
  | { kind: 'editor'; chordId: string | null }
  | { kind: 'actions'; chordId: string };

export function App() {
  const [song, setSong] = useStoredSong();
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const { myChords, remember } = useMyChords();
  const close = useCallback(() => setOverlay({ kind: 'none' }), []);
  const apply = (fn: (s: Song) => Song) => {
    setSong(fn);
    close();
  };

  return (
    <div className="app">
      <header className="app-bar">
        <span className="brand">Guitar Cords</span>
        <span className="app-bar-title">Song</span>
      </header>
      <SongScreen
        song={song}
        update={setSong}
        onAddChord={() => setOverlay({ kind: 'picker' })}
        onChordTap={(chordId) => setOverlay({ kind: 'actions', chordId })}
      />
      <OverlayView overlay={overlay} song={song} myChords={myChords} remember={remember} setOverlay={setOverlay} close={close} apply={apply} />
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
  apply: (fn: (s: Song) => Song) => void;
}

function OverlayView({ overlay, song, myChords, remember, setOverlay, close, apply }: OverlayProps) {
  if (overlay.kind === 'picker') {
    return (
      <Sheet label="Add a chord" onClose={close}>
        <ChordPicker
          songKey={song.key}
          myChords={myChords}
          onPick={(choice: ChordChoice) => apply((s) => addChord(s, choice))}
          onCreate={() => setOverlay({ kind: 'editor', chordId: null })}
          onClose={close}
        />
      </Sheet>
    );
  }
  if (overlay.kind === 'editor') return <EditorSheet song={song} chordId={overlay.chordId} close={close} apply={apply} remember={remember} />;
  const chord = overlay.kind === 'actions' ? findChord(song, overlay.chordId) : undefined;
  return chord ? <ActionsSheet song={song} chord={chord} setOverlay={setOverlay} close={close} apply={apply} /> : null;
}

const editorTitle = (existing?: SongChord) => (existing ? `Edit ${existing.symbol}` : 'New chord');

/** Editing keeps the chord's own name (it may be custom); a new chord starts empty in the song key. */
const editorStart = (song: Song, existing?: SongChord) => ({
  initialShape: existing?.shape,
  initialName: existing?.symbol ?? null,
  initialKey: song.key ?? '',
});

interface EditorSheetProps {
  song: Song;
  chordId: string | null;
  close: () => void;
  apply: OverlayProps['apply'];
  remember: OverlayProps['remember'];
}

function EditorSheet({ song, chordId, close, apply, remember }: EditorSheetProps) {
  const existing = chordId ? findChord(song, chordId) : undefined;
  const title = editorTitle(existing);
  const save = ({ name, shape }: SavedChord) => {
    const choice = { symbol: name, shape };
    remember(choice);
    apply((s) => (chordId ? replaceChord(s, chordId, choice) : addChord(s, choice)));
  };
  return (
    <Sheet label={title} onClose={close} wide>
      <h2 className="sheet-title editor-sheet-title">{title}</h2>
      <ChordEditor {...editorStart(song, existing)} onSave={save} onCancel={close} />
    </Sheet>
  );
}

interface ActionsProps {
  song: Song;
  chord: SongChord;
  setOverlay: (o: Overlay) => void;
  close: () => void;
  apply: OverlayProps['apply'];
}

function ActionsSheet({ song, chord, setOverlay, close, apply }: ActionsProps) {
  return (
    <Sheet label={`${chord.symbol} chord options`} onClose={close}>
      <ChordActions
        chord={chord}
        beatsPerBar={song.beatsPerBar}
        onEdit={() => setOverlay({ kind: 'editor', chordId: chord.id })}
        onLength={(beats) => apply((s) => setChordBeats(s, chord.id, beats))}
        onDelete={() => apply((s) => removeChord(s, chord.id))}
        onClose={close}
      />
    </Sheet>
  );
}
