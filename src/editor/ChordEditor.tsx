import { useMemo, useReducer, useState } from 'react';
import { nameChord, type ChordName } from '../music/chordNaming';
import { soundingMidi, toFretString, type ChordShape, type Finger } from '../music/chordShape';
import { spell, spellingForKey } from '../music/chordSymbol';
import { KeySelect } from '../components/KeySelect';
import { ChordDiagram } from './ChordDiagram';
import { ChordSymbol } from './ChordSymbol';
import { MAX_START_FRET, editorReducer, initialEditorState, type EditorAction, type EditorState } from './editorReducer';
import './ChordEditor.css';

export interface SavedChord {
  name: string;
  frets: string;
  shape: ChordShape;
}

interface Props {
  onSave?: (chord: SavedChord) => void;
  onCancel?: () => void;
  initialKey?: string;
  /** Shape to edit; starts empty when omitted. */
  initialShape?: ChordShape;
  /** Name to start with when editing a saved chord (may be a custom name). */
  initialName?: string | null;
  /** Open-string pitches (default standard tuning). */
  tuning?: readonly number[];
}

const initState = (shape?: ChordShape) =>
  shape ? editorReducer(initialEditorState, { type: 'load', shape }) : initialEditorState;

const MAX_ALTERNATIVES = 4;

const isBlank = (shape: ChordShape) => shape.dots.length === 0 && shape.muted.length === 0;

/**
 * Ranked names for the shape. `current` is the creator's pick if still valid, else the best.
 * `typed` is a name the creator wrote themselves; it wins over detection until they pick an alternative.
 */
function useChordNames(shape: ChordShape, songKey: string, initialName: string | null, tuning?: readonly number[]) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [typed, setTyped] = useState<string | null>(initialName);
  const candidates = useMemo(() => detectNames(shape, songKey, tuning), [shape, songKey, tuning]);
  const current = candidates.find((c) => c.symbol === chosen) ?? candidates[0];
  const pick = (symbol: string) => {
    setChosen(symbol);
    setTyped(null);
  };
  return { candidates, current, typed, setTyped, pick, ...nameView(typed, current) };
}

const detectNames = (shape: ChordShape, songKey: string, tuning?: readonly number[]) => (isBlank(shape) ? [] : nameChord(shape, songKey || undefined, tuning));

/** What the UI shows: a typed name wins over the detected one. */
function nameView(typed: string | null, current: ChordName | undefined) {
  if (typed !== null) return { displayName: typed.trim(), fieldValue: typed, shownCurrent: undefined };
  const detectedName = current?.symbol ?? '';
  return { displayName: detectedName, fieldValue: detectedName, shownCurrent: current };
}

const selectedFinger = (state: EditorState) => state.shape.dots.find((d) => d.string === state.selected)?.finger ?? null;

export function ChordEditor({ onSave, onCancel, initialKey = '', initialShape, initialName = null, tuning }: Props) {
  const [state, dispatch] = useReducer(editorReducer, initialShape, initState);
  const [songKey, setSongKey] = useState(initialKey);
  const names = useChordNames(state.shape, songKey, initialName, tuning);
  const { candidates, current, displayName, shownCurrent } = names;
  const blank = isBlank(state.shape);
  const save = () => onSave?.({ name: displayName, frets: toFretString(state.shape), shape: state.shape });

  return (
    <section className="editor" aria-label="Chord editor">
      <div className="editor-stage card">
        <NamePanel shape={state.shape} name={displayName} inKey={!!shownCurrent?.inKey} songKey={songKey} tuning={tuning} />
        <ChordDiagram state={state} dispatch={dispatch} />
        <RefusalHint refusal={state.refusal} />
        <PositionStepper startFret={state.startFret} dispatch={dispatch} />
      </div>
      <div className="editor-side">
        <NameField value={names.fieldValue} detected={!!current} disabled={blank} onChange={names.setTyped} />
        <FingerPicker finger={selectedFinger(state)} dispatch={dispatch} />
        <Alternatives candidates={candidates} current={shownCurrent} onPick={names.pick} />
        <KeySelect value={songKey} onChange={setSongKey} />
        <EditorActions canClear={!blank} canSave={!blank && displayName !== ''} onCancel={onCancel} onClear={() => dispatch({ type: 'clear' })} onSave={save} />
        <p className="editor-help">Tap a cell to place a finger · drag to move it · hold a finger, then drag across strings for a barre · tap a selected finger to remove it · tap above the nut for open ○ / muted ×</p>
      </div>
    </section>
  );
}

interface ActionsProps {
  canClear: boolean;
  canSave: boolean;
  onCancel?: () => void;
  onClear: () => void;
  onSave: () => void;
}

function EditorActions({ canClear, canSave, onCancel, onClear, onSave }: ActionsProps) {
  return (
    <div className="editor-actions">
      {onCancel && (
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      )}
      <button type="button" className="btn ghost" onClick={onClear} disabled={!canClear}>
        Clear
      </button>
      <button type="button" className="btn primary" disabled={!canSave} onClick={onSave}>
        Save chord
      </button>
    </div>
  );
}

function NameField({ value, detected, disabled, onChange }: { value: string; detected: boolean; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <label className="name-field">
      <span className="section-label">Chord name</span>
      <input
        value={value}
        disabled={disabled}
        placeholder={detected ? '' : 'No standard name — type your own'}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </label>
  );
}

function NamePanel({ shape, name, inKey, songKey, tuning }: { shape: ChordShape; name: string; inKey: boolean; songKey: string; tuning?: readonly number[] }) {
  if (isBlank(shape)) {
    return (
      <header className="name-panel is-empty">
        <p className="name-hint">Tap a string to place your first finger</p>
      </header>
    );
  }
  return (
    <header className="name-panel">
      <ChordSymbol symbol={name} />
      <p className="name-notes" aria-label="Notes played">
        {playedNotes(shape, songKey, tuning).join(' · ')}
        <InKeyBadge songKey={songKey} inKey={inKey} />
      </p>
    </header>
  );
}

const playedNotes = (shape: ChordShape, songKey: string, tuning?: readonly number[]) =>
  soundingMidi(shape, tuning)
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

const REFUSALS: Record<string, string> = {
  'under-barre': "Can't place a finger under the barre — it would be silent.",
  occupied: 'That string already has a finger. Move or remove it first.',
  'off-board': "That's off the fretboard.",
};

function RefusalHint({ refusal }: { refusal?: string | null }) {
  return (
    <p className={`refusal-hint${refusal ? ' is-shown' : ''}`} role="status" aria-live="polite">
      {refusal ? REFUSALS[refusal] : ''}
    </p>
  );
}
