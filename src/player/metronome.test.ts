import { clicksBetween } from './metronome';

const at = (bpm: number, beats: number, unit: 2 | 4 | 8 | 16, from: number, to: number, start = 0) =>
  clicksBetween({ bpm, ts: { beats, unit }, start, from, to });

describe('clicksBetween', () => {
  it('clicks every quarter in 4/4 with the first beat accented', () => {
    expect(at(120, 4, 4, 0, 2.01)).toEqual([
      { time: 0, beat: 0, accent: true },
      { time: 0.5, beat: 1, accent: false },
      { time: 1, beat: 2, accent: false },
      { time: 1.5, beat: 3, accent: false },
      { time: 2, beat: 0, accent: true },
    ]);
  });

  it('clicks eighths in 6/8 and accents every bar of six', () => {
    const clicks = at(60, 6, 8, 0, 3.01);
    expect(clicks.map((c) => c.time)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3]);
    expect(clicks.filter((c) => c.accent).map((c) => c.time)).toEqual([0, 3]);
  });

  it('returns only the clicks inside the window, counting from the start time', () => {
    expect(at(60, 3, 4, 10.5, 12.5, 10).map((c) => [c.time, c.beat])).toEqual([
      [11, 1],
      [12, 2],
    ]);
  });

  it('is empty before the start', () => {
    expect(at(60, 4, 4, 0, 1, 5)).toEqual([]);
  });
});
