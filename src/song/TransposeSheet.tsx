/**
 * Transpose & key: move the song by half steps or to a chosen key — with new chord
 * shapes, or the same shapes and a capo — and quick "easier with a capo" options.
 */
import { useState } from 'react';
import { SheetHeader } from '../components/Sheet';
import { ChordSymbol } from '../editor/ChordSymbol';
import { parseKey } from '../music/chordSymbol';
import { capoFor } from '../music/transpose';
import { chordSymbols, type Song } from './song';
import { MAX_CAPO, playInShapes, semitonesBetween, soundingKey, transposeSong, withCapo } from './transposeSong';
import './HitSheet.css';

const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const PREVIEW_CHORDS = 8;

type Method = 'shapes' | 'capo';

export const describeKey = (key: string | null) => {
  const k = key ? parseKey(key) : null;
  return k ? `${k.tonic} ${k.mode}` : 'no key set';
};

interface Props {
  song: Song;
  onApply: (next: Song) => void;
  onClose: () => void;
}

/** The song moved `n` half steps by the chosen method. */
function moved(song: Song, n: number, method: Method): Song {
  return method === 'capo' ? withCapo(song, (song.capo ?? 0) + n) : transposeSong(song, n);
}

const capoAllowed = (song: Song, n: number) => n > 0 && (song.capo ?? 0) + n <= MAX_CAPO;

export function TransposeSheet({ song, onApply, onClose }: Props) {
  const [n, setN] = useState(0);
  const [method, setMethod] = useState<Method>('shapes');
  const useCapo = method === 'capo' && capoAllowed(song, n);
  const result = moved(song, n, useCapo ? 'capo' : 'shapes');
  return (
    <div className="transpose">
      <SheetHeader title="Transpose & key" onClose={onClose} />
      <CurrentKey song={song} />
      <MoveControls song={song} n={n} setN={setN} />
      <Preview from={song} to={result} />
      <MethodChoice song={song} n={n} useCapo={useCapo} setMethod={setMethod} />
      <CapoTips song={song} n={n} onApply={onApply} />
      <div className="hit-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn primary" disabled={n === 0} onClick={() => onApply(result)}>
          Apply
        </button>
      </div>
    </div>
  );
}

function CurrentKey({ song }: { song: Song }) {
  return (
    <p className="transpose-now">
      Written in <strong>{describeKey(song.key)}</strong>
      {song.capo ? ` · capo ${song.capo} · sounds in ${describeKey(soundingKey(song))}` : ''}
    </p>
  );
}

const stepsLabel = (song: Song, n: number) => {
  const steps = `${n > 0 ? `+${n}` : n} half ${Math.abs(n) === 1 ? 'step' : 'steps'}`;
  return song.key && n !== 0 ? `${steps} → ${describeKey(transposeSong(song, n).key)}` : steps;
};

function MoveControls({ song, n, setN }: { song: Song; n: number; setN: (n: number) => void }) {
  return (
    <section className="hit-section">
      <span className="section-label">Move the song</span>
      <div className="stepper">
        <button type="button" className="icon-btn" aria-label="Down a half step" onClick={() => setN(n - 1)} disabled={n <= -11}>
          −
        </button>
        <span className="stepper-value" aria-live="polite">
          {stepsLabel(song, n)}
        </span>
        <button type="button" className="icon-btn" aria-label="Up a half step" onClick={() => setN(n + 1)} disabled={n >= 11}>
          +
        </button>
      </div>
      <KeyPicker songKey={song.key} onPick={(target) => setN(semitonesBetween(song.key!, target))} />
    </section>
  );
}

function KeyPicker({ songKey, onPick }: { songKey: string | null; onPick: (key: string) => void }) {
  const mode = songKey ? parseKey(songKey)?.mode : undefined;
  const suffix = mode === 'minor' ? 'm' : '';
  return (
    <label className="mini-field wide">
      <span className="section-label">Or pick the new key</span>
      <select aria-label="New key" disabled={!songKey} value="" onChange={(e) => onPick(`${e.target.value}${suffix}`)}>
        <option value="">{songKey ? 'Choose a key…' : 'Set the song key first'}</option>
        {KEYS.map((k) => (
          <option key={k} value={k}>
            {k} {mode ?? 'major'}
          </option>
        ))}
      </select>
    </label>
  );
}

function MethodChoice({ song, n, useCapo, setMethod }: { song: Song; n: number; useCapo: boolean; setMethod: (m: Method) => void }) {
  return (
    <section className="hit-section">
      <span className="section-label">How to play it</span>
      <div className="seg" role="radiogroup" aria-label="Method">
        <button type="button" role="radio" aria-checked={!useCapo} onClick={() => setMethod('shapes')}>
          New chord shapes
        </button>
        <button type="button" role="radio" aria-checked={useCapo} disabled={!capoAllowed(song, n)} onClick={() => setMethod('capo')}>
          Same shapes + capo {(song.capo ?? 0) + Math.max(n, 0)}
        </button>
      </div>
    </section>
  );
}

function Preview({ from, to }: { from: Song; to: Song }) {
  const before = chordSymbols(from).slice(0, PREVIEW_CHORDS);
  const after = chordSymbols(to).slice(0, PREVIEW_CHORDS);
  if (before.length === 0) return null;
  return (
    <section className="hit-section">
      <span className="section-label">Preview</span>
      <p className="transpose-preview">
        <span className="from">{before.join(' ')}</span>
        <span aria-hidden="true"> → </span>
        <span data-testid="transpose-preview">{after.join(' ')}</span>
      </p>
    </section>
  );
}

/** Easy open-chord keys that sound in the target key with a capo. */
function CapoTips({ song, n, onApply }: { song: Song; n: number; onApply: (s: Song) => void }) {
  const target = soundingKey(transposeSong(song, n));
  const tips = target ? capoFor(target).filter((t) => t.capo > 0) : [];
  if (tips.length === 0) return null;
  return (
    <section className="hit-section">
      <span className="section-label">Easier with a capo — sounds in {describeKey(target)}</span>
      <div className="chip-row">
        {tips.map((t) => (
          <button key={t.capo} type="button" className="name-chip" onClick={() => onApply(playInShapes(transposeSong(song, n), t.shapesKey))}>
            <ChordSymbol symbol={t.shapesKey} inline /> shapes, capo {t.capo}
          </button>
        ))}
      </div>
    </section>
  );
}
