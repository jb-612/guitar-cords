/**
 * Bar menu (button, right-click or long-press on a bar): change the time signature or
 * tempo from this bar on, insert a bar before/after, duplicate or delete the bar.
 */
import { useState } from 'react';
import { SheetHeader } from '../components/Sheet';
import './HitSheet.css';
import { COMMON_TIME_SIGNATURES, formatTimeSignature, sameTimeSignature } from './rhythm';
import { patternsFor } from './patterns';
import { barTimeSignature, tempoAt, type Song } from './song';

interface Props {
  song: Song;
  index: number;
  onTimeSignature: (ts: (typeof COMMON_TIME_SIGNATURES)[number]) => void;
  onTempo: (bpm: number | null) => void;
  onInsert: (where: 'before' | 'after') => void;
  onDuplicate: () => void;
  onMove: (to: number) => void;
  onPattern: (patternId: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function BarMenu({ song, index, onTimeSignature, onTempo, onInsert, onDuplicate, onMove, onPattern, onDelete, onClose }: Props) {
  const n = index + 1;
  const current = barTimeSignature(song, index);
  const [bpm, setBpm] = useState(String(tempoAt(song, index)));
  const hasTempoChange = index > 0 && song.bars[index]?.tempo !== undefined;
  return (
    <div className="bar-menu">
      <SheetHeader title={`Bar ${n}`} onClose={onClose} />
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
      <section className="hit-section">
        <label className="section-label" htmlFor={`tempo-${index}`}>
          Tempo from bar {n}
        </label>
        <div className="tempo-row">
          <input id={`tempo-${index}`} type="number" min={20} max={300} value={bpm} aria-label={`Tempo from bar ${n}`} onChange={(e) => setBpm(e.target.value)} />
          <span className="tempo-unit">bpm</span>
          <button type="button" className="btn ghost" onClick={() => onTempo(Number(bpm))} disabled={!(Number(bpm) >= 20 && Number(bpm) <= 300)}>
            Set tempo
          </button>
          {hasTempoChange && (
            <button type="button" className="btn ghost" onClick={() => onTempo(null)}>
              Remove change
            </button>
          )}
        </div>
      </section>
      <div className="hit-actions">
        <button type="button" className="btn ghost" onClick={() => onInsert('before')}>
          Insert bar before
        </button>
        <button type="button" className="btn ghost" onClick={() => onInsert('after')}>
          Insert bar after
        </button>
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
