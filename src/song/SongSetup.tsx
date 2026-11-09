/** New-song setup: title, time signature and tempo. */
import { useState } from 'react';
import { SheetHeader } from '../components/Sheet';
import './HitSheet.css';
import { COMMON_TIME_SIGNATURES, formatTimeSignature, sameTimeSignature, type TimeSignature } from './rhythm';
import type { SongSetup as Setup } from './song';

interface Props {
  onCreate: (setup: Setup) => void;
  onClose: () => void;
}

export function SongSetup({ onCreate, onClose }: Props) {
  const [title, setTitle] = useState('Untitled song');
  const [ts, setTs] = useState<TimeSignature>(COMMON_TIME_SIGNATURES[0]!);
  const [bpm, setBpm] = useState('90');
  const tempo = Number(bpm);
  const valid = title.trim() !== '' && tempo >= 20 && tempo <= 300;
  return (
    <form
      className="song-setup"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onCreate({ title: title.trim(), timeSignature: ts, tempo });
      }}
    >
      <SheetHeader title="New song" onClose={onClose} />
      <label className="hit-section">
        <span className="section-label">Title</span>
        <input className="text-input" aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} onFocus={(e) => e.target.select()} />
      </label>
      <section className="hit-section">
        <span className="section-label">Time signature</span>
        <div className="seg wrap" role="radiogroup" aria-label="Time signature">
          {COMMON_TIME_SIGNATURES.map((t) => (
            <button key={formatTimeSignature(t)} type="button" role="radio" aria-checked={sameTimeSignature(t, ts)} onClick={() => setTs(t)}>
              {formatTimeSignature(t)}
            </button>
          ))}
        </div>
      </section>
      <label className="hit-section">
        <span className="section-label">Tempo (bpm)</span>
        <input className="text-input" type="number" min={20} max={300} aria-label="Tempo (bpm)" value={bpm} onChange={(e) => setBpm(e.target.value)} />
      </label>
      <p className="setup-note">This replaces the song you're working on. Its chords stay in My chords.</p>
      <div className="hit-actions">
        <button type="submit" className="btn primary" disabled={!valid}>
          Create song
        </button>
      </div>
    </form>
  );
}
