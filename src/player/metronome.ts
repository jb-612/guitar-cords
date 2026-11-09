/**
 * Standalone metronome (Web Audio): ticks without the song playing, at the song's tempo
 * and time signature, accenting the first beat of each bar. While the song plays,
 * alphaTab's own metronome is used instead so the clicks stay in sync with playback.
 */
import { createContext } from 'react';
import type { TimeSignature } from '../song/rhythm';

export interface Click {
  /** Seconds, on the same clock as `start`. */
  time: number;
  beat: number;
  accent: boolean;
}

interface ClickWindow {
  bpm: number;
  ts: TimeSignature;
  /** When beat 0 sounds. */
  start: number;
  from: number;
  to: number;
}

/** Seconds per click: the time signature's unit (quarter in x/4, eighth in x/8) at `bpm` quarters per minute. */
const clickInterval = (bpm: number, ts: TimeSignature) => (60 / bpm) * (4 / ts.unit);

/** Clicks sounding in [from, to). */
export function clicksBetween({ bpm, ts, start, from, to }: ClickWindow): Click[] {
  const interval = clickInterval(bpm, ts);
  const clicks: Click[] = [];
  for (let i = Math.max(0, Math.ceil((from - start) / interval - 1e-9)); start + i * interval < to; i++) {
    const beat = i % ts.beats;
    clicks.push({ time: start + i * interval, beat, accent: beat === 0 });
  }
  return clicks;
}

export interface MetronomeSettings {
  bpm: number;
  ts: TimeSignature;
  /** 0..1, default 0.8. */
  volume?: number;
}

export interface Metronome {
  start(settings: MetronomeSettings): void;
  stop(): void;
  /** Called as each beat sounds (for the beat indicator). */
  onBeat(listener: (beat: number) => void): () => void;
}

const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
const CLICK_S = 0.05;

function playClick(ctx: AudioContext, time: number, accent: boolean, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = accent ? 1600 : 1100;
  gain.gain.setValueAtTime(Math.max(0.0011, (accent ? 0.6 : 0.4) * volume), time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_S);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + CLICK_S);
}

/** Lookahead scheduler: every TICK_MS, schedule the clicks due in the next LOOKAHEAD_S. */
export function createWebAudioMetronome(): Metronome {
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let window = { start: 0, until: 0 };
  let current: MetronomeSettings | null = null;
  const listeners = new Set<(beat: number) => void>();
  const pending = new Set<ReturnType<typeof setTimeout>>();

  const announce = (click: Click, now: number) => {
    const t = setTimeout(() => {
      pending.delete(t);
      listeners.forEach((l) => l(click.beat));
    }, (click.time - now) * 1000);
    pending.add(t);
  };

  const tick = () => {
    if (!ctx || !current) return;
    const until = ctx.currentTime + LOOKAHEAD_S;
    for (const click of clicksBetween({ ...current, start: window.start, from: window.until, to: until })) {
      playClick(ctx, click.time, click.accent, current.volume ?? 0.8);
      announce(click, ctx.currentTime);
    }
    window = { ...window, until };
  };

  const stop = () => {
    clearInterval(timer);
    pending.forEach(clearTimeout);
    pending.clear();
    current = null;
  };

  return {
    start(settings) {
      stop();
      ctx ??= new AudioContext();
      void ctx.resume();
      current = settings;
      const start = ctx.currentTime + 0.05;
      window = { start, until: start };
      timer = setInterval(tick, TICK_MS);
      tick();
    },
    stop,
    onBeat(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/** Tests provide a fake; the app uses Web Audio, created on first use. */
export const MetronomeContext = createContext<() => Metronome>(createWebAudioMetronome);
