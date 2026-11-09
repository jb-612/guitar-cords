/**
 * Tab entry for riffs and bass lines: one fret box per string (high E on top, as in tab),
 * the note name under each fretted string, and a length. Used for new notes and for
 * editing a note event (then with Duplicate and Delete).
 */
import { useState } from 'react';
import { Note } from '@tonaljs/tonal';
import { SheetHeader } from '../components/Sheet';
import { STRING_COUNT } from '../music/chordShape';
import { cleanNotes, MAX_FRET } from './notes';
import { LENGTH_CHOICES } from './rhythm';
import type { TabNote } from './song';
import './HitSheet.css';
import './ChordPicker.css';
import './NotesSheet.css';

interface Props {
  title: string;
  tuning: readonly number[];
  initial?: TabNote[];
  /** Set when editing: the event's current length. Without it the sheet adds new notes. */
  units?: number;
  onSave: (notes: TabNote[], units: number | null) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}

type Frets = Record<number, string>;

const pitchName = (midi: number) => Note.pitchClass(Note.fromMidiSharps(midi));
const toFrets = (notes: TabNote[] = []): Frets => Object.fromEntries(notes.map((n) => [n.string, String(n.fret)]));
const toNotes = (frets: Frets): TabNote[] =>
  cleanNotes(Object.entries(frets).filter(([, v]) => v !== '').map(([s, v]) => ({ string: Number(s), fret: Number(v) })));

/** Digits only, and nothing past the last fret. */
const acceptable = (v: string) => /^\d{0,2}$/.test(v) && (v === '' || Number(v) <= MAX_FRET);

export function NotesSheet({ title, tuning, initial, units, onSave, onDuplicate, onDelete, onClose }: Props) {
  const [frets, setFrets] = useState<Frets>(() => toFrets(initial));
  const [length, setLength] = useState<number | null>(units ?? null);
  const notes = toNotes(frets);
  const editing = units !== undefined;
  const lengths = editing ? LENGTH_CHOICES.filter(([, u]) => u !== null) : LENGTH_CHOICES;
  const setFret = (s: number, v: string) => acceptable(v) && setFrets((f) => ({ ...f, [s]: v }));
  return (
    <div className="notes-sheet" data-testid="notes-sheet">
      <SheetHeader title={title} onClose={onClose} />
      <div className="tab-entry" role="group" aria-label="Frets per string">
        {Array.from({ length: STRING_COUNT }, (_, i) => STRING_COUNT - 1 - i).map((s) => (
          <StringRow key={s} string={s} open={tuning[s]!} value={frets[s] ?? ''} onChange={(v) => setFret(s, v)} />
        ))}
      </div>
      <div className="picker-length">
        <span className="section-label">Length</span>
        <div className="seg" role="radiogroup" aria-label="Length">
          {lengths.map(([label, u]) => (
            <button key={label} type="button" role="radio" aria-checked={length === u} onClick={() => setLength(u)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <Actions editing={editing} canSave={notes.length > 0} onSave={() => onSave(notes, length)} onDuplicate={onDuplicate} onDelete={onDelete} />
    </div>
  );
}

interface ActionsProps {
  editing: boolean;
  canSave: boolean;
  onSave: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

function Actions({ editing, canSave, onSave, onDuplicate, onDelete }: ActionsProps) {
  return (
    <div className="notes-actions">
      {onDelete && (
        <button type="button" className="btn ghost danger" onClick={onDelete}>
          Delete notes
        </button>
      )}
      {onDuplicate && (
        <button type="button" className="btn ghost" onClick={onDuplicate}>
          Duplicate
        </button>
      )}
      <button type="button" className="btn primary" disabled={!canSave} onClick={onSave}>
        {editing ? 'Save' : 'Add'}
      </button>
    </div>
  );
}

function StringRow({ string, open, value, onChange }: { string: number; open: number; value: string; onChange: (v: string) => void }) {
  const n = STRING_COUNT - string;
  return (
    <label className="tab-row">
      <span className="tab-string">{`String ${n} (${pitchName(open)})`}</span>
      <span className="tab-line" aria-hidden="true" />
      <input
        className="tab-fret"
        type="text"
        inputMode="numeric"
        aria-label={`String ${n} fret`}
        placeholder="–"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
      />
      <span className="tab-pitch" aria-hidden="true">
        {value === '' ? '' : pitchName(open + Number(value))}
      </span>
    </label>
  );
}
