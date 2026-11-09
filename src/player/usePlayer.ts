/**
 * Player state for a song: the engine (created on first need), transport settings,
 * playback position, the bar-section loop, and the active view.
 */
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Song } from '../song/song';
import { songToAlphaTex } from './alphaTex';
import { EngineFactoryContext, type BarRange, type PlayerEngine, type PlayerEvent, type ScoreView } from './engine';

export type SongView = 'chords' | ScoreView;

export interface Position {
  bar: number;
  beat: number;
}

export interface PlayerSettings {
  speed: number;
  looping: boolean;
  metronome: boolean;
  range: BarRange | null;
  hideFingers: boolean;
  view: SongView;
}

const DEFAULTS: PlayerSettings = { speed: 1, looping: false, metronome: false, range: null, hideFingers: false, view: 'chords' };

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
  const tex = useMemo(() => songToAlphaTex(song), [song]);

  const ensureEngine = useCallback(() => {
    if (engine || !host) return engine;
    const created = factory(host);
    created.subscribe((e: PlayerEvent) => {
      if (e.type === 'state') setPlaying(e.playing);
      if (e.type === 'position') setPosition({ bar: e.bar, beat: e.beat });
      if (e.type === 'error') setError(e.message);
    });
    setEngine(created);
    return created;
  }, [engine, host, factory]);

  useEffect(() => () => engine?.destroy(), [engine]);
  useSync(engine, tex, (e, t) => e.load(t));
  useSync(engine, settings.speed, (e, v) => e.setSpeed(v));
  useSync(engine, settings.looping, (e, v) => e.setLooping(v));
  useSync(engine, settings.metronome, (e, v) => e.setMetronome(v));
  useSync(engine, settings.range, (e, v) => e.setRange(v));
  useSync(engine, settings.view, (e, v) => v !== 'chords' && e.setView(v));

  const update = (patch: Partial<PlayerSettings>) => setSettings((s) => ({ ...s, ...patch }));
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
    settings,
    section,
    update,
    setView,
    playPause: () => ensureEngine()?.playPause(),
    stop: () => {
      engine?.stop();
      setPosition(null);
    },
  };
}

export type Player = ReturnType<typeof usePlayer>;
