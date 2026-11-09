import { act } from '@testing-library/react';
import type { EngineFactory, PlayerEngine, PlayerEvent } from '../player/engine';

/** Records every engine call; `emit` plays engine events into the UI. */
export class FakeEngine implements PlayerEngine {
  calls: [string, unknown?][] = [];
  private listeners = new Set<(e: PlayerEvent) => void>();

  load = (tex: string) => void this.calls.push(['load', tex]);
  setView = (v: unknown) => void this.calls.push(['setView', v]);
  playPause = () => void this.calls.push(['playPause']);
  stop = () => void this.calls.push(['stop']);
  setSpeed = (r: number) => void this.calls.push(['setSpeed', r]);
  setLooping = (on: boolean) => void this.calls.push(['setLooping', on]);
  setRange = (r: unknown) => void this.calls.push(['setRange', r]);
  setMetronome = (on: boolean) => void this.calls.push(['setMetronome', on]);
  setDrums = (on: boolean) => void this.calls.push(['setDrums', on]);
  setCountIn = (on: boolean) => void this.calls.push(['setCountIn', on]);
  setVolumes = (v: unknown) => void this.calls.push(['setVolumes', v]);
  destroy = () => void this.calls.push(['destroy']);
  subscribe = (l: (e: PlayerEvent) => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };

  emit(e: PlayerEvent) {
    act(() => this.listeners.forEach((l) => l(e)));
  }

  /** Argument of the most recent call to `name`. */
  last(name: string): unknown {
    return [...this.calls].reverse().find(([n]) => n === name)?.[1];
  }

  count(name: string): number {
    return this.calls.filter(([n]) => n === name).length;
  }
}

export function fakeEngineFactory() {
  const engines: FakeEngine[] = [];
  const factory: EngineFactory = () => {
    const e = new FakeEngine();
    engines.push(e);
    return e;
  };
  return { factory, engines };
}
