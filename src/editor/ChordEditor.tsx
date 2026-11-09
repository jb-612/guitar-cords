import { useMemo, useReducer, useState } from 'react';
import { nameChord, type ChordName } from '../music/chordNaming';
import { soundingMidi, toFretString, type ChordShape, type Finger } from '../music/chordShape';
import { spell, spellingForKey } from '../music/chordSymbol';
import { ChordDiagram } from './ChordDiagram';
import { ChordSymbol } from './ChordSymbol';
import { MAX_START_FRET, editorReducer, initialEditorState, type EditorAction } from './editorReducer';
import './ChordEditor.css';

export interface SavedChord {
  name: string;
  frets: string;
  shape: ChordShape;
}

interface Props {
  onSave?: (chord: SavedChord) => void;
  initialKey?: string;
}

const MAX_ALTERNATIVES = 4;

const isBlank = (shape: ChordShape) => shape.dots.length === 0 && shape.muted.length === 0;

/** Ranked names for the shape; `current` is the creator's pick if still valid, else the best. */
function useChordNames(shape: ChordShape, songKey: string) {
  const [chosen, setChosen] = useState<string | null>(null);
  const candidates = useMemo(() => (isBlank(shape) ? [] : nameChord(shape, songKey || undefined)), [shape, songKey]);
  const current = candidates.find((c) => c.symbol === chosen) ?? candidates[0];
  return { candidates, current, setChosen };
}

export function ChordEditor({ onSave, initialKey = '' }: Props) {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const [songKey, setSongKey] = useState(initialKey);
  const { candidates, current, setChosen } = useChordNames(state.shape, songKey);
  const selectedDot = state.shape.dots.find((d) => d.string === state.selected);
  const save = () => {
    if (current) onSave?.({ name: current.symbol, frets: toFretString(state.shape), shape: state.shape });
  };

  return (
    <section className="editor" aria-label="Chord editor">
      <div className="editor-stage card">
        <NamePanel shape={state.shape} current={current} songKey={songKey} />
        <ChordDiagram state={state} dispatch={dispatch} />
        <PositionStepper startFret={state.startFret} dispatch={dispatch} />
      </div>
      <div className="editor-side">
        <FingerPicker finger={selectedDot?.finger ?? null} dispatch={dispatch} />
        <Alternatives candidates={candidates} current={current} onPick={setChosen} />
        <KeySelect value={songKey} onChange={setSongKey} />
        <div className="editor-actions">
          <button type="button" className="btn ghost" onClick={() => dispatch({ type: 'clear' })} disabled={isBlank(state.shape)}>
            Clear
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!current}
            onClick={save}
          >
            Save chord
          </button>
        </div>
        <p className="editor-help">Tap a cell to place a finger · drag to move it · tap a selected finger to remove it · tap above the nut for open ○ / muted ×</p>
      </div>
    </section>
  );
}

function NamePanel({ shape, current, songKey }: { shape: ChordShape; current?: ChordName; songKey: string }) {
  if (isBlank(shape)) {
    return (
      <header className="name-panel is-empty">
        <p className="name-hint">Tap a string to place your first finger</p>
      </header>
    );
  }
  return (
    <header className="name-panel">
      <ChordSymbol symbol={current?.symbol} />
      <p className="name-notes" aria-label="Notes played">
        {playedNotes(shape, songKey).join(' · ')}
        <InKeyBadge songKey={songKey} inKey={!!current?.inKey} />
      </p>
    </header>
  );
}

const playedNotes = (shape: ChordShape, songKey: string) =>
  soundingMidi(shape)
    .filter((m): m is number => m !== null)
    .map((m) => spell(m, spellingForKey(songKey || undefined)));

function InKeyBadge({ songKey, inKey }: { songKey: string; inKey: boolean }) {
  return songKey && inKey ? <span className="badge">in {songKey}</span> : null;
}

function PositionStepper({ startFret, dispatch }: { startFret: number; dispatch: (a: EditorAction) => void }) {
  return (
    <div className="stepper" role="group" aria-label="Fret position">
      <button type="button" className="icon-btn" aria-label="Move down the neck" disabled={startFret <= 1} onClick={() => dispatch({ type: 'window', delta: -1 })}>
        <Chevron up />
      </button>
      <span className="stepper-value" aria-live="polite">
        {startFret === 1 ? 'Open position' : `Fret ${startFret}`}
      </span>
      <button type="button" className="icon-btn" aria-label="Move up the neck" disabled={startFret >= MAX_START_FRET} onClick={() => dispatch({ type: 'window', delta: 1 })}>
        <Chevron />
      </button>
    </div>
  );
}

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" style={{ transform: up ? 'rotate(180deg)' : undefined }}>
      <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FINGERS: { finger: Finger; label: string; short: string }[] = [
  { finger: 1, label: 'Index', short: '1' },
  { finger: 2, label: 'Middle', short: '2' },
  { finger: 3, label: 'Ring', short: '3' },
  { finger: 4, label: 'Pinky', short: '4' },
  { finger: 0, label: 'Thumb', short: 'T' },
];

function FingerPicker({ finger, dispatch }: { finger: Finger | null; dispatch: (a: EditorAction) => void }) {
  const disabled = finger === null;
  return (
    <div className={`finger-picker${disabled ? ' is-disabled' : ''}`}>
      <div className="section-label">{disabled ? 'Select a finger dot to change it' : 'Finger'}</div>
      <div className="finger-row" role="radiogroup" aria-label="Finger">
        {FINGERS.map((f) => (
          <button
            key={f.finger}
            type="button"
            role="radio"
            aria-checked={finger === f.finger}
            aria-label={f.label}
            disabled={disabled}
            className="finger-chip"
            onClick={() => dispatch({ type: 'finger', finger: f.finger })}
          >
            <span className="finger-num">{f.short}</span>
            <span className="finger-name">{f.label}</span>
          </button>
        ))}
        <button type="button" className="finger-chip remove" aria-label="Remove finger" disabled={disabled} onClick={() => dispatch({ type: 'remove' })}>
          <span className="finger-num">×</span>
          <span className="finger-name">Remove</span>
        </button>
      </div>
    </div>
  );
}

function Alternatives({ candidates, current, onPick }: { candidates: ChordName[]; current?: ChordName; onPick: (s: string) => void }) {
  const others = candidates.filter((c) => c !== current && c.common).slice(0, MAX_ALTERNATIVES);
  if (others.length === 0) return null;
  return (
    <div className="alternatives">
      <div className="section-label">Also known as</div>
      <div className="chip-row">
        {others.map((c) => (
          <button key={c.symbol} type="button" className="name-chip" aria-label={c.symbol} onClick={() => onPick(c.symbol)}>
            <ChordSymbol symbol={c.symbol} inline />
          </button>
        ))}
      </div>
    </div>
  );
}

const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

function KeySelect({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  return (
    <label className="key-select">
      <span className="section-label">Song key</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No key</option>
        <optgroup label="Major">
          {KEYS.map((k) => (
            <option key={k} value={k}>{k} major</option>
          ))}
        </optgroup>
        <optgroup label="Minor">
          {['A', 'E', 'B', 'F#', 'C#', 'G#', 'D', 'G', 'C', 'F', 'Bb', 'Eb'].map((k) => (
            <option key={k} value={`${k}m`}>{k} minor</option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
