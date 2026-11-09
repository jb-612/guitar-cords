/**
 * The playback/rendering engine behind the song player. The real one wraps alphaTab
 * (alphaTabEngine.ts); tests use a fake. Engines are created lazily, on the first
 * Play or Tab/Score view, so alphaTab never loads for creators who only write chords.
 */
import { createContext } from 'react';

export type ScoreView = 'tab' | 'score';

/** Bar indexes, inclusive. */
export interface BarRange {
  from: number;
  to: number;
}

export type PlayerEvent =
  | { type: 'ready' }
  | { type: 'state'; playing: boolean }
  /** Position: song bar index and the offset into it, in units of a 1/32 note. */
  | { type: 'position'; bar: number; unit: number }
  | { type: 'error'; message: string };

export interface PlayerEngine {
  load(alphaTex: string): void;
  setView(view: ScoreView): void;
  playPause(): void;
  stop(): void;
  /** 1 = written tempo, 0.5 = half speed. */
  setSpeed(ratio: number): void;
  setLooping(on: boolean): void;
  setRange(range: BarRange | null): void;
  setMetronome(on: boolean): void;
  subscribe(listener: (e: PlayerEvent) => void): () => void;
  destroy(): void;
}

export type EngineFactory = (host: HTMLElement) => PlayerEngine;

/** Default: the alphaTab engine, loaded on first use. Tests provide a fake factory. */
export const EngineFactoryContext = createContext<EngineFactory>((host) => {
  // Imported lazily so alphaTab (and its fonts/soundfont) load only when playback is used.
  let engine: PlayerEngine | null = null;
  const queued: ((e: PlayerEngine) => void)[] = [];
  const listeners = new Set<(e: PlayerEvent) => void>();
  void import('./alphaTabEngine').then(({ createAlphaTabEngine }) => {
    engine = createAlphaTabEngine(host);
    listeners.forEach((l) => engine!.subscribe(l));
    queued.splice(0).forEach((call) => call(engine!));
  });
  const run = (call: (e: PlayerEngine) => void) => (engine ? call(engine) : queued.push(call));
  return {
    load: (tex) => run((e) => e.load(tex)),
    setView: (v) => run((e) => e.setView(v)),
    playPause: () => run((e) => e.playPause()),
    stop: () => run((e) => e.stop()),
    setSpeed: (r) => run((e) => e.setSpeed(r)),
    setLooping: (on) => run((e) => e.setLooping(on)),
    setRange: (r) => run((e) => e.setRange(r)),
    setMetronome: (on) => run((e) => e.setMetronome(on)),
    subscribe: (listener) => {
      listeners.add(listener);
      const off = engine?.subscribe(listener);
      return () => {
        listeners.delete(listener);
        off?.();
      };
    },
    destroy: () => run((e) => e.destroy()),
  };
});
