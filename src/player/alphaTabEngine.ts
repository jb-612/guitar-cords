/**
 * PlayerEngine backed by alphaTab: renders tab/score into `host` and plays the song
 * through its synthesizer with the bundled SoundFont. Calls made before the SoundFont
 * is ready (e.g. Play) are applied once it is.
 */
import { AlphaTabApi, LayoutMode, PlayerMode, StaveProfile, synth, type model } from '@coderline/alphatab';
import type { BarRange, PlayerEngine, PlayerEvent, ScoreView } from './engine';

const base = import.meta.env.BASE_URL;
/** alphaTab uses 960 MIDI ticks per quarter note; a quarter is 8 units. */
const TICKS_PER_UNIT = 960 / 8;
const STAVE_PROFILE: Record<ScoreView, StaveProfile> = { tab: StaveProfile.Tab, score: StaveProfile.Score };

export function createAlphaTabEngine(host: HTMLElement): PlayerEngine {
  const api = new AlphaTabApi(host, {
    core: { fontDirectory: `${base}font/`, useWorkers: true },
    display: { staveProfile: StaveProfile.Tab, layoutMode: LayoutMode.Page, scale: 0.95 },
    player: {
      playerMode: PlayerMode.EnabledSynthesizer,
      soundFont: `${base}soundfont/sonivox.sf2`,
      enableCursor: true,
      enableAnimatedBeatCursor: true,
      enableUserInteraction: true,
      scrollElement: host.parentElement ?? undefined,
    },
  });
  const listeners = new Set<(e: PlayerEvent) => void>();
  const emit = (e: PlayerEvent) => listeners.forEach((l) => l(e));
  let ready = false;
  let wantsPlay = false;
  let range: BarRange | null = null;
  let drumsOn = false;
  /** Track 1 is the drum track when the song has one. */
  const applyDrums = () => {
    const drums = api.score?.tracks[1];
    if (drums) api.changeTrackMute([drums], !drumsOn);
  };

  api.playerReady.on(() => {
    ready = true;
    applyRange(api, range);
    emit({ type: 'ready' });
    if (wantsPlay) api.play();
    wantsPlay = false;
  });
  api.playerStateChanged.on((e) => emit({ type: 'state', playing: e.state === synth.PlayerState.Playing }));
  api.playedBeatChanged.on((beat: model.Beat) => emit({ type: 'position', bar: beat.voice.bar.index, unit: Math.round(beat.playbackStart / TICKS_PER_UNIT) }));
  api.error.on((e) => emit({ type: 'error', message: String(e.message ?? e) }));
  api.scoreLoaded.on(() => {
    applyRange(api, range);
    applyDrums();
  });

  return {
    // Only the guitar (track 0) is drawn; drums play but stay out of the tab/score.
    load: (tex) => api.tex(tex, [0]),
    setView: (view) => {
      api.settings.display.staveProfile = STAVE_PROFILE[view];
      api.updateSettings();
      api.render();
    },
    playPause: () => {
      if (ready) api.playPause();
      else wantsPlay = !wantsPlay;
    },
    stop: () => {
      wantsPlay = false;
      api.stop();
    },
    setSpeed: (ratio) => (api.playbackSpeed = ratio),
    setLooping: (on) => (api.isLooping = on),
    setRange: (r) => {
      range = r;
      applyRange(api, r);
    },
    setMetronome: (on) => (api.metronomeVolume = on ? 1 : 0),
    setDrums: (on) => {
      drumsOn = on;
      applyDrums();
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    destroy: () => api.destroy(),
  };
}

/** Bar range -> MIDI ticks of the loaded score. */
function applyRange(api: AlphaTabApi, range: BarRange | null) {
  api.playbackRange = range ? ticksFor(api.score?.masterBars ?? [], range) : null;
}

function ticksFor(bars: model.MasterBar[], range: BarRange) {
  const first = bars[range.from];
  const last = bars[range.to];
  return first && last ? { startTick: first.start, endTick: last.start + last.calculateDuration() } : null;
}
