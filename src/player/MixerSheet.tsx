/** Sound & practice: volumes, guitar sound, swing, count-in, drum fills/ending, speed trainer. */
import type { ReactNode } from 'react';
import { SheetHeader } from '../components/Sheet';
import type { GuitarSound, Song } from '../song/song';
import type { Volumes } from './engine';
import type { Player } from './usePlayer';
import '../song/HitSheet.css';
import './MixerSheet.css';

interface Props {
  song: Song;
  player: Player;
  onSongChange: (fn: (s: Song) => Song) => void;
  onClose: () => void;
}

const SOUNDS: [GuitarSound, string][] = [
  ['steel', 'Steel'],
  ['nylon', 'Nylon'],
  ['electric', 'Electric'],
];
const TRAINER_STEPS = [0.02, 0.05, 0.1];
const TRAINER_TARGETS = [0.8, 0.9, 1, 1.1, 1.2];
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function MixerSheet({ song, player, onSongChange, onClose }: Props) {
  const { settings, update } = player;
  const setVolume = (k: keyof Volumes) => (v: number) => update({ volumes: { ...settings.volumes, [k]: v } });
  return (
    <div className="mixer">
      <SheetHeader title="Sound & practice" onClose={onClose} />
      <section className="hit-section">
        <span className="section-label">Volumes</span>
        <Slider label="Guitar volume" value={settings.volumes.guitar} onChange={setVolume('guitar')} />
        <Slider label="Drums volume" value={settings.volumes.drums} onChange={setVolume('drums')} />
        <Slider label="Metronome volume" value={settings.volumes.metronome} onChange={setVolume('metronome')} />
      </section>
      <section className="hit-section">
        <span className="section-label">Guitar sound</span>
        <div className="seg" role="radiogroup" aria-label="Guitar sound">
          {SOUNDS.map(([sound, label]) => (
            <button key={sound} type="button" role="radio" aria-checked={(song.sound ?? 'steel') === sound} onClick={() => onSongChange((s) => ({ ...s, sound }))}>
              {label}
            </button>
          ))}
        </div>
        <Check label="Swing feel (eighths played long-short)" checked={song.swing === true} onChange={(swing) => onSongChange((s) => ({ ...s, swing }))} />
      </section>
      <section className="hit-section">
        <span className="section-label">Playback</span>
        <Check label="Count-in (a bar of clicks before playing)" checked={settings.countIn} onChange={(countIn) => update({ countIn })} />
        <Check label="Drum fills every 4 bars" checked={settings.drumFills} onChange={(drumFills) => update({ drumFills })} />
        <Check label="Crash & ending on the drums" checked={settings.drumEnding} onChange={(drumEnding) => update({ drumEnding })} />
      </section>
      <Trainer player={player} />
    </div>
  );
}

function Trainer({ player }: { player: Player }) {
  const { trainer } = player.settings;
  const set = (patch: Partial<typeof trainer>) => player.update({ trainer: { ...trainer, ...patch }, ...(patch.on ? { looping: true } : {}) });
  return (
    <section className="hit-section">
      <span className="section-label">Practice</span>
      <Check label={`Speed trainer: +${pct(trainer.step)} each loop, up to ${pct(trainer.target)}`} checked={trainer.on} onChange={(on) => set({ on })}>
        <span className="trainer-options">
          <select aria-label="Speed step" value={trainer.step} onChange={(e) => set({ step: Number(e.target.value) })}>
            {TRAINER_STEPS.map((s) => (
              <option key={s} value={s}>
                +{pct(s)}
              </option>
            ))}
          </select>
          <select aria-label="Target speed" value={trainer.target} onChange={(e) => set({ target: Number(e.target.value) })}>
            {TRAINER_TARGETS.map((t) => (
              <option key={t} value={t}>
                up to {pct(t)}
              </option>
            ))}
          </select>
        </span>
      </Check>
    </section>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mixer-slider">
      <span>{label.replace(' volume', '')}</span>
      <input type="range" aria-label={label} min={0} max={100} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} />
      <span className="mixer-value">{pct(value)}</span>
    </label>
  );
}

function Check({ label, checked, onChange, children }: { label: string; checked: boolean; onChange: (v: boolean) => void; children?: ReactNode }) {
  return (
    <div className="mixer-check">
      <label>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {checked && children}
    </div>
  );
}
