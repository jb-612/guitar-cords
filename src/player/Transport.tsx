/**
 * Sticky transport bar: play/pause, stop, tempo, loop, metronome, practice mode, and
 * the bar-section loop.
 */
import { useState } from 'react';
import { Sheet } from '../components/Sheet';
import type { Song } from '../song/song';
import { MixerSheet } from './MixerSheet';
import { DRUM_STYLES, type DrumStyle } from './drums';
import type { Player } from './usePlayer';
import './player.css';

const MIN_SPEED = 25;
const MAX_SPEED = 200;

interface TransportProps {
  song: Song;
  player: Player;
  onSongChange: (fn: (s: Song) => Song) => void;
}

export function Transport({ song, player, onSongChange }: TransportProps) {
  const { settings, update } = player;
  const [mixer, setMixer] = useState(false);
  const percent = Math.round(settings.speed * 100);
  return (
    <div className="transport" role="toolbar" aria-label="Playback">
      {player.error && <PlaybackError message={player.error} onDismiss={player.dismissError} />}
      <div className="transport-main">
        <button type="button" className="play-btn" aria-label={player.playing ? 'Pause' : 'Play'} disabled={song.bars.length === 0} onClick={player.playPause}>
          {player.playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" className="icon-btn" aria-label="Stop" onClick={player.stop}>
          <StopIcon />
        </button>
        <label className="tempo">
          <span className="tempo-readout">
            <strong>{Math.round(song.tempo * settings.speed)} bpm</strong>
            <span>{percent}%</span>
          </span>
          <input
            type="range"
            aria-label="Tempo"
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={5}
            value={percent}
            onChange={(e) => update({ speed: Number(e.target.value) / 100 })}
          />
        </label>
      </div>
      <TransportToggles song={song} player={player} onMixer={() => setMixer(true)} />
      {mixer && (
        <Sheet label="Sound & practice" onClose={() => setMixer(false)}>
          <MixerSheet song={song} player={player} onSongChange={onSongChange} onClose={() => setMixer(false)} />
        </Sheet>
      )}
    </div>
  );
}

/** A playback problem, shown above the transport until dismissed. */
function PlaybackError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="playback-error" role="alert">
      <span>
        <strong>Playback problem.</strong> {message}
      </span>
      <button type="button" className="chip-toggle" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

function TransportToggles({ song, player, onMixer }: { song: Song; player: Player; onMixer: () => void }) {
  const { settings, update } = player;
  return (
    <div className="transport-toggles">
        <Toggle label="Loop" on={settings.looping} onClick={() => update({ looping: !settings.looping })} icon="⟲" />
        <Toggle label="Metronome" on={settings.metronome} onClick={player.toggleMetronome} icon="♩" />
        {player.metronomeBeat !== null && <BeatDots beat={player.metronomeBeat} beats={song.timeSignature.beats} />}
        <Toggle label="Drums" on={settings.drums} onClick={() => update({ drums: !settings.drums })} icon="◎" />
        <select className="drum-style" aria-label="Drum style" value={settings.drumStyle} onChange={(e) => update({ drumStyle: e.target.value as DrumStyle })}>
          {DRUM_STYLES.map((d) => (
            <option key={d.style} value={d.style}>
              {d.label}
            </option>
          ))}
        </select>
        <Toggle label="Hide fingers" on={settings.hideFingers} onClick={() => update({ hideFingers: !settings.hideFingers })} icon="◌" />
        <Section player={player} />
        <button type="button" className="toggle" aria-label="Sound & practice" onClick={onMixer}>
          <span className="toggle-icon" aria-hidden="true">≋</span>
          <span className="toggle-label" aria-hidden="true">Mix</span>
        </button>
      </div>
  );
}

const MAX_DOTS = 12;

/** One dot per beat; the sounding beat lights up (first beat brighter). */
function BeatDots({ beat, beats }: { beat: number; beats: number }) {
  return (
    <span className="beat-dots" role="img" aria-label={`Beat ${beat + 1} of ${beats}`}>
      {Array.from({ length: Math.min(beats, MAX_DOTS) }, (_, i) => (
        <span key={i} className={`beat-dot${i === beat ? ' is-on' : ''}${i === 0 ? ' is-one' : ''}`} />
      ))}
    </span>
  );
}

function Toggle({ label, on, onClick, icon }: { label: string; on: boolean; onClick: () => void; icon: string }) {
  return (
    <button type="button" className="toggle" aria-pressed={on} aria-label={label} onClick={onClick}>
      <span className="toggle-icon" aria-hidden="true">{icon}</span>
      <span className="toggle-label" aria-hidden="true">{label}</span>
    </button>
  );
}

function Section({ player }: { player: Player }) {
  const { range } = player.settings;
  if (range) {
    return (
      <span className="section-chip">
        <span>{range.from === range.to ? `Bar ${range.from + 1}` : `Bars ${range.from + 1}–${range.to + 1}`}</span>
        <button type="button" aria-label="Clear section" onClick={() => player.update({ range: null })}>
          ×
        </button>
      </span>
    );
  }
  return (
    <button type="button" className={`toggle${player.section.picking ? ' is-picking' : ''}`} aria-pressed={player.section.picking} onClick={player.section.startPicking}>
      <span className="toggle-icon" aria-hidden="true">[ ]</span>
      <span className="toggle-label">{player.section.picking ? 'Tap first & last bar' : 'Loop section'}</span>
    </button>
  );
}

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
  </svg>
);
const StopIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </svg>
);
