import { act } from '@testing-library/react';
import type { Metronome, MetronomeSettings } from '../player/metronome';

/** Records start/stop; `beat` plays a beat into the UI. */
export class FakeMetronome implements Metronome {
  running: MetronomeSettings | null = null;
  starts: MetronomeSettings[] = [];
  stops = 0;
  private listeners = new Set<(beat: number) => void>();

  start = (s: MetronomeSettings) => {
    this.running = s;
    this.starts.push(s);
  };
  stop = () => {
    if (this.running) this.stops++;
    this.running = null;
  };
  onBeat = (l: (beat: number) => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  beat(n: number) {
    act(() => this.listeners.forEach((l) => l(n)));
  }
}
