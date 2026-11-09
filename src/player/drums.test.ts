// @vitest-environment node
import * as at from '@coderline/alphatab';
import { songToAlphaTex } from './alphaTex';
import { DRUM_STYLES, type DrumStyle } from './drums';
import { addChord, createSong, setTimeSignatureFrom, type Song } from '../song/song';
import { shapeFromFrets } from '../music/chordShape';
import type { TimeSignature } from '../song/rhythm';

const KICK = 35;
const SNARE = 38;
const SIDE_STICK = 37;
const SHAKER = 82;
const RIDE = 51;

const parse = (song: Song, drums?: DrumStyle) => at.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(song, { drums }));
const withChords = (ts: TimeSignature, bars = 2) => {
  let s = createSong({ timeSignature: ts });
  for (let i = 0; i < bars; i++) s = addChord(s, { symbol: 'G', shape: shapeFromFrets('320003') });
  return s;
};
const drumTrack = (score: at.model.Score) => score.tracks[1]!;
/** MIDI notes per drum beat in a bar, e.g. [[35, 42], [42], ...]. */
const hitsIn = (score: at.model.Score, bar: number) => {
  const t = drumTrack(score);
  return t.staves[0]!.bars[bar]!.voices[0]!.beats.map((b) => b.notes.map((n) => t.percussionArticulations[n.percussionArticulation]!.outputMidiNumber));
};

describe('drum track', () => {
  it('is left out when drums are not chosen', () => {
    expect(parse(withChords({ beats: 4, unit: 4 })).tracks).toHaveLength(1);
  });

  it('adds a percussion track with one bar per song bar', () => {
    const score = parse(withChords({ beats: 4, unit: 4 }, 3), 'basic');
    expect(drumTrack(score).staves[0]!.isPercussion).toBe(true);
    expect(drumTrack(score).staves[0]!.bars).toHaveLength(3);
  });

  const meters: TimeSignature[] = [
    { beats: 4, unit: 4 },
    { beats: 3, unit: 4 },
    { beats: 2, unit: 4 },
    { beats: 5, unit: 4 },
    { beats: 6, unit: 8 },
    { beats: 7, unit: 8 },
    { beats: 9, unit: 8 },
    { beats: 12, unit: 8 },
  ];
  for (const style of DRUM_STYLES.map((d) => d.style)) {
    it.each(meters.map((m) => [`${m.beats}/${m.unit}`, m] as const))(`${style} fills every bar exactly in %s`, (_, ts) => {
      const score = parse(withChords(ts), style);
      const bars = drumTrack(score).staves[0]!.bars;
      for (const bar of bars) {
        const ticks = bar.voices[0]!.beats.reduce((n, b) => n + b.playbackDuration, 0);
        expect(ticks).toBe(bar.masterBar.calculateDuration());
      }
    });
  }

  it('basic 4/4: kick on 1 and 3, snare on 2 and 4, hi-hat eighths', () => {
    const beats = hitsIn(parse(withChords({ beats: 4, unit: 4 }), 'basic'), 0);
    expect(beats).toHaveLength(8);
    expect(beats.map((b) => b.includes(KICK))).toEqual([true, false, false, false, true, false, false, false]);
    expect(beats.map((b) => b.includes(SNARE))).toEqual([false, false, true, false, false, false, true, false]);
  });

  it('bossa nova uses side-stick and shaker', () => {
    const all = hitsIn(parse(withChords({ beats: 4, unit: 4 }), 'bossa'), 0).flat();
    expect(all).toContain(SIDE_STICK);
    expect(all).toContain(SHAKER);
    expect(all).not.toContain(SNARE);
  });

  it('swing plays the ride in triplets', () => {
    const score = parse(withChords({ beats: 4, unit: 4 }), 'swing');
    const beats = drumTrack(score).staves[0]!.bars[0]!.voices[0]!.beats;
    expect(beats.every((b) => b.tupletNumerator === 3)).toBe(true);
    expect(hitsIn(score, 0).flat()).toContain(RIDE);
  });

  it('follows a time-signature change mid-song', () => {
    const song = setTimeSignatureFrom(withChords({ beats: 4, unit: 4 }, 3), 1, { beats: 3, unit: 4 });
    const bars = drumTrack(parse(song, 'basic')).staves[0]!.bars;
    expect(bars.map((b) => b.voices[0]!.beats.length)).toEqual([8, 6, 6]);
  });

  it('adds nothing for an empty song', () => {
    expect(parse(createSong(), 'basic').tracks).toHaveLength(1);
  });

  describe('fills, crash and ending', () => {
    const CRASH = 57;
    const TOMS = [50, 48, 47, 45, 43, 41];
    const eight = () => withChords({ beats: 4, unit: 4 }, 8);
    const parseWith = (opts: { fills?: boolean; ending?: boolean }) =>
      at.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(eight(), { drums: 'basic', drumFills: opts.fills, drumEnding: opts.ending }));

    it('plays a fill at the end of every 4-bar phrase and a crash after it', () => {
      const score = parseWith({ fills: true });
      expect(hitsIn(score, 3).flat().some((n) => TOMS.includes(n))).toBe(true);
      expect(hitsIn(score, 2).flat().some((n) => TOMS.includes(n))).toBe(false);
      expect(hitsIn(score, 4)[0]).toContain(CRASH);
      expect(hitsIn(score, 0)[0]).toContain(CRASH);
    });

    it('ends with one crash on the last downbeat', () => {
      const last = hitsIn(parseWith({ ending: true }), 7);
      expect(last[0]).toContain(CRASH);
      expect(last.slice(1).every((b) => b.length === 0)).toBe(true);
    });

    it('fills and endings keep every bar full, also in swing and 6/8', () => {
      for (const style of ['basic', 'bossa', 'swing'] as const) {
        for (const ts of [{ beats: 4, unit: 4 }, { beats: 6, unit: 8 }] as TimeSignature[]) {
          const song = withChords(ts, 8);
          const score = at.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(song, { drums: style, drumFills: true, drumEnding: true }));
          for (const bar of drumTrack(score).staves[0]!.bars) {
            expect(bar.voices[0]!.beats.reduce((n, b) => n + b.playbackDuration, 0)).toBe(bar.masterBar.calculateDuration());
          }
        }
      }
    });
  });
});
