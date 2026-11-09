/**
 * Bar menu (button, right-click or long-press on a bar): change the time signature or
 * tempo from this bar on, insert a bar before/after, duplicate or delete the bar.
 */
import { useState } from 'react';
import { SheetHeader } from '../components/Sheet';
import './HitSheet.css';
import { COMMON_TIME_SIGNATURES, formatTimeSignature, sameTimeSignature } from './rhythm';
import { patternsFor } from './patterns';
import { barTimeSignature, tempoAt, type Bar, type Song } from './song';

export interface StructureActions {
  section: (label: string | null) => void;
  repeatStart: (on: boolean) => void;
  repeatEnd: (times: number | null) => void;
  endings: (list: number[]) => void;
}

const SECTIONS = ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Solo', 'Outro'];
const REPEAT_TIMES = [2, 3, 4];
const ORDINAL = ['', '1st', '2nd', '3rd'];

interface Props {
  song: Song;
  index: number;
  onTimeSignature: (ts: (typeof COMMON_TIME_SIGNATURES)[number]) => void;
  onTempo: (bpm: number | null) => void;
  onInsert: (where: 'before' | 'after') => void;
  onDuplicate: () => void;
  onMove: (to: number) => void;
  onPattern: (patternId: string) => void;
  structure: StructureActions;
  onSelect: () => void;
  /** Present when the clipboard has bars. */
  onPaste?: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function BarMenu({ song, index, onTimeSignature, onTempo, onInsert, onDuplicate, onMove, onPattern, structure, onSelect, onPaste, onDelete, onClose }: Props) {
  const n = index + 1;
  const bar = song.bars[index]!;
  const current = barTimeSignature(song, index);
  return (
    <div className="bar-menu">
      <SheetHeader title={`Bar ${n}`} onClose={onClose} />
      <SectionChoice bar={bar} onSection={structure.section} />
      <Repeats bar={bar} actions={structure} />
      <section className="hit-section">
        <span className="section-label">Strum pattern</span>
        <div className="chip-row">
          {patternsFor(current).map((p) => (
            <button key={p.id} type="button" className="name-chip" onClick={() => onPattern(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </section>
      <section className="hit-section">
        <span className="section-label">Time signature from bar {n}</span>
        <div className="seg wrap" role="radiogroup" aria-label={`Time signature from bar ${n}`}>
          {COMMON_TIME_SIGNATURES.map((t) => (
            <button key={formatTimeSignature(t)} type="button" role="radio" aria-checked={sameTimeSignature(t, current)} onClick={() => onTimeSignature(t)}>
              {formatTimeSignature(t)}
            </button>
          ))}
        </div>
      </section>
      <TempoChange song={song} index={index} onTempo={onTempo} />
      <div className="hit-actions">
        <button type="button" className="btn ghost" onClick={() => onInsert('before')}>
          Insert bar before
        </button>
        <button type="button" className="btn ghost" onClick={() => onInsert('after')}>
          Insert bar after
        </button>
        <button type="button" className="btn ghost" onClick={onSelect}>
          Select bars
        </button>
        {onPaste && (
          <button type="button" className="btn ghost" onClick={onPaste}>
            Paste after
          </button>
        )}
        <button type="button" className="btn ghost" onClick={onDuplicate}>
          Duplicate bar
        </button>
        <button type="button" className="btn ghost" onClick={() => onMove(index - 1)} disabled={index === 0}>
          Move bar earlier
        </button>
        <button type="button" className="btn ghost" onClick={() => onMove(index + 1)} disabled={index === song.bars.length - 1}>
          Move bar later
        </button>
        <button type="button" className="btn ghost danger" onClick={onDelete}>
          Delete bar
        </button>
      </div>
    </div>
  );
}

function SectionChoice({ bar, onSection }: { bar: Bar; onSection: (label: string | null) => void }) {
  return (
    <section className="hit-section">
      <span className="section-label">Section starting here</span>
      <div className="chip-row">
        {SECTIONS.map((label) => (
          <button key={label} type="button" className="name-chip" aria-pressed={bar.section === label} onClick={() => onSection(bar.section === label ? null : label)}>
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function Repeats({ bar, actions }: { bar: Bar; actions: StructureActions }) {
  return (
    <section className="hit-section repeats">
      <span className="section-label">Repeats</span>
      <label className="mixer-check-inline">
        <input type="checkbox" checked={!!bar.repeatStart} onChange={(e) => actions.repeatStart(e.target.checked)} />
        Repeat starts here ‖:
      </label>
      <label className="mixer-check-inline">
        <input type="checkbox" checked={!!bar.repeatEnd} onChange={(e) => actions.repeatEnd(e.target.checked ? 2 : null)} />
        Repeat ends here :‖
        {bar.repeatEnd && (
          <select aria-label="Times played" value={bar.repeatEnd} onChange={(e) => actions.repeatEnd(Number(e.target.value))}>
            {REPEAT_TIMES.map((n) => (
              <option key={n} value={n}>
                play {n}×
              </option>
            ))}
          </select>
        )}
      </label>
      <div className="chip-row">
        {[1, 2, 3].map((n) => (
          <label key={n} className="mixer-check-inline">
            <input
              type="checkbox"
              checked={!!bar.endings?.includes(n)}
              onChange={(e) => actions.endings(e.target.checked ? [...(bar.endings ?? []), n] : (bar.endings ?? []).filter((x) => x !== n))}
            />
            {ORDINAL[n]} ending
          </label>
        ))}
      </div>
    </section>
  );
}

const validBpm = (bpm: string) => Number(bpm) >= 20 && Number(bpm) <= 300;

function TempoChange({ song, index, onTempo }: { song: Song; index: number; onTempo: (bpm: number | null) => void }) {
  const n = index + 1;
  const [bpm, setBpm] = useState(String(tempoAt(song, index)));
  const hasTempoChange = index > 0 && song.bars[index]?.tempo !== undefined;
  return (
      <section className="hit-section">
        <label className="section-label" htmlFor={`tempo-${index}`}>
          Tempo from bar {n}
        </label>
        <div className="tempo-row">
          <input id={`tempo-${index}`} type="number" min={20} max={300} value={bpm} aria-label={`Tempo from bar ${n}`} onChange={(e) => setBpm(e.target.value)} />
          <span className="tempo-unit">bpm</span>
          <button type="button" className="btn ghost" onClick={() => onTempo(Number(bpm))} disabled={!validBpm(bpm)}>
            Set tempo
          </button>
          {hasTempoChange && (
            <button type="button" className="btn ghost" onClick={() => onTempo(null)}>
              Remove change
            </button>
          )}
        </div>
      </section>
  );
}
