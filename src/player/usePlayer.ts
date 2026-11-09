/**
 * Player state for a song: the engine (created on first need), transport settings,
 * playback position, the bar-section loop, and the active view.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Song } from '../song/song';
import { songToAlphaTex } from './alphaTex';
import type { DrumStyle } from './drums';
import { EngineFactoryContext, type BarRange, type PlayerEngine, type PlayerEvent, type ScoreView, type Volumes } from './engine';
import { MetronomeContext, type Metronome } from './metronome';

export type SongView = 'chords' | ScoreView;

export interface Position {
  bar: number;
  /** Offset into the bar in units of a 1/32 note. */
  unit: number;
}

export interface PlayerSettings {
  speed: number;
  looping: boolean;
  metronome: boolean;
  range: BarRange | null;
  hideFingers: boolean;
  view: SongView;
  drums: boolean;
  drumStyle: DrumStyle;
  drumFills: boolean;
  drumEnding: boolean;
  countIn: boolean;
  volumes: Volumes;
  trainer: Trainer;
}

/** Speed trainer: each completed loop adds `step` to the speed, up to `target`. */
export interface Trainer {
  on: boolean;
  step: number;
  target: number;
}

const DEFAULTS: PlayerSettings = {
  speed: 1,
  looping: false,
  metronome: false,
  range: null,
  hideFingers: false,
  view: 'chords',
  drums: false,
  drumStyle: 'basic',
  drumFills: false,
  drumEnding: false,
  countIn: false,
  volumes: { guitar: 1, drums: 0.8, metronome: 0.8 },
  trainer: { on: false, step: 0.05, target: 1 },
};

/** Next speed after a completed loop pass. */
export const trainedSpeed = (speed: number, t: Trainer) => Math.min(t.target, Math.round((speed + t.step) * 100) / 100);

/** Section picking: first tap sets the anchor bar, second tap closes the range. */
function useSectionPicker(setSettings: (fn: (s: PlayerSettings) => PlayerSettings) => void) {
  const [picking, setPicking] = useState(false);
  const [anchor, setAnchor] = useState<number | null>(null);
  const pickBar = (bar: number) => {
    if (anchor === null) return setAnchor(bar);
    setSettings((s) => ({ ...s, range: { from: Math.min(anchor, bar), to: Math.max(anchor, bar) }, looping: true }));
    setPicking(false);
    setAnchor(null);
  };
  const startPicking = () => {
    setPicking(true);
    setAnchor(null);
  };
  return { picking, anchor, pickBar, startPicking };
}

/** Push one setting to the engine whenever it (or the engine) changes. */
function useSync<T>(engine: PlayerEngine | null, value: T, apply: (e: PlayerEngine, v: T) => void) {
  useEffect(() => {
    if (engine) apply(engine, value);
    // `apply` is a stable inline lambda per call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, value]);
}

/**
 * The standalone metronome: runs while `on` (metronome enabled and the song not playing),
 * restarting when tempo or meter change. Returns the beat that last sounded.
 */
function useStandaloneMetronome(on: boolean, bpm: number, song: Song, volume: number) {
  const create = useContext(MetronomeContext);
  const [metronome, setMetronome] = useState<Metronome | null>(null);
  const [beat, setBeat] = useState<number | null>(null);
  const { beats, unit } = song.timeSignature;
  const ensure = () => {
    if (metronome) return metronome;
    const m = create();
    m.onBeat(setBeat);
    setMetronome(m);
    return m;
  };
  useEffect(() => {
    if (!metronome) return;
    if (on) metronome.start({ bpm, ts: { beats, unit }, volume });
    return () => metronome.stop();
  }, [metronome, on, bpm, beats, unit, volume]);
  return { beat: on ? beat : null, ensure };
}

/**
 * Speed trainer: playback jumping back to an earlier bar means a loop pass finished.
 * Returns a ref'd handler (stable for the engine subscription) fed with each position's bar.
 */
function useLoopPass(settings: PlayerSettings, setSettings: (fn: (s: PlayerSettings) => PlayerSettings) => void) {
  const last = useRef(-1);
  const trainer = useRef(settings.trainer);
  const handler = useRef((bar: number) => {
    const wrapped = bar < last.current;
    last.current = bar;
    if (wrapped && trainer.current.on) setSettings((s) => ({ ...s, speed: trainedSpeed(s.speed, s.trainer) }));
  });
  useEffect(() => {
    trainer.current = settings.trainer;
  }, [settings.trainer]);
  return handler;
}

export function usePlayer(song: Song) {
  const factory = useContext(EngineFactoryContext);
  // Callback ref: the element alphaTab renders into, kept in state so the engine can be created when it exists.
  const [host, attachHost] = useState<HTMLDivElement | null>(null);
  const [engine, setEngine] = useState<PlayerEngine | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULTS);
  const section = useSectionPicker(setSettings);
  const { drumStyle, drumFills, drumEnding } = settings;
  const tex = useMemo(() => songToAlphaTex(song, { drums: drumStyle, drumFills, drumEnding }), [song, drumStyle, drumFills, drumEnding]);
  const onLoopPass = useLoopPass(settings, setSettings);
  const click = useStandaloneMetronome(settings.metronome && !playing, Math.round(song.tempo * settings.speed), song, settings.volumes.metronome);

  const ensureEngine = useCallback(() => {
    if (engine || !host) return engine;
    const created = factory(host);
    created.subscribe((e: PlayerEvent) => {
      if (e.type === 'state') setPlaying(e.playing);
      if (e.type === 'position') {
        setPosition({ bar: e.bar, unit: e.unit });
        onLoopPass.current(e.bar);
      }
      if (e.type === 'error') setError(e.message);
    });
    setEngine(created);
    return created;
  }, [engine, host, factory, onLoopPass]);

  useEffect(() => () => engine?.destroy(), [engine]);
  useSync(engine, tex, (e, t) => e.load(t));
  useSync(engine, settings.speed, (e, v) => e.setSpeed(v));
  useSync(engine, settings.looping, (e, v) => e.setLooping(v));
  useSync(engine, settings.metronome, (e, v) => e.setMetronome(v));
  useSync(engine, settings.range, (e, v) => e.setRange(v));
  useSync(engine, settings.drums, (e, v) => e.setDrums(v));
  useSync(engine, settings.countIn, (e, v) => e.setCountIn(v));
  useSync(engine, settings.volumes, (e, v) => e.setVolumes(v));
  useSync(engine, settings.view, (e, v) => v !== 'chords' && e.setView(v));

  const update = (patch: Partial<PlayerSettings>) => setSettings((s) => ({ ...s, ...patch }));
  /** Turning the metronome on creates it (in the click handler, so audio may start). */
  const toggleMetronome = () => {
    if (!settings.metronome) click.ensure();
    update({ metronome: !settings.metronome });
  };
  /** Tab and score are drawn by the engine, so opening them creates it. */
  const setView = (view: SongView) => {
    if (view !== 'chords') ensureEngine();
    update({ view });
  };
  return {
    attachHost,
    playing,
    position,
    error,
    dismissError: () => setError(null),
    settings,
    section,
    update,
    setView,
    toggleMetronome,
    /** Beat the standalone metronome last clicked (null when it is not ticking). */
    metronomeBeat: click.beat,
    playPause: () => ensureEngine()?.playPause(),
    stop: () => {
      engine?.stop();
      setPosition(null);
    },
  };
}

export type Player = ReturnType<typeof usePlayer>;
