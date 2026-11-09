// @vitest-environment node
import * as at from '@coderline/alphatab';
import { copyBars, deleteBars, pasteBars, setEndings, setRepeatEnd, setRepeatStart, setSection } from './structure';
import { addChord, barTimeSignature, createSong, setTimeSignatureFrom, type Song } from './song';
import { shapeFromFrets } from '../music/chordShape';
import { songToAlphaTex } from '../player/alphaTex';

const add = (s: Song, symbol: string) => addChord(s, { symbol, shape: shapeFromFrets('320003') });
const abcd = () => ['A', 'B', 'C', 'D'].reduce(add, createSong());
const order = (s: Song) => s.bars.map((b) => (b.events[0] as { symbol?: string }).symbol ?? '-');
const parse = (s: Song) => at.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(s));

describe('sections', () => {
  it('labels a bar as the start of a section, and clears it', () => {
    const s = setSection(abcd(), 1, 'Chorus');
    expect(s.bars[1]!.section).toBe('Chorus');
    expect(setSection(s, 1, null).bars[1]!.section).toBeUndefined();
    expect(parse(s).masterBars[1]!.section?.text).toBe('Chorus');
  });
});

describe('repeats and endings', () => {
  it('writes repeat start, repeat end (play count) and alternate endings', () => {
    let s = setRepeatStart(abcd(), 0, true);
    s = setRepeatEnd(s, 2, 2);
    s = setEndings(s, 2, [1]);
    s = setEndings(s, 3, [2]);
    const bars = parse(s).masterBars;
    expect(bars[0]!.isRepeatStart).toBe(true);
    expect(bars[2]!.repeatCount).toBe(2);
    expect(bars[2]!.alternateEndings).toBe(1);
    expect(bars[3]!.alternateEndings).toBe(2);
  });

  it('clears them again', () => {
    const s = setEndings(setRepeatEnd(setRepeatStart(abcd(), 0, true), 2, 2), 2, [1]);
    const cleared = setEndings(setRepeatEnd(setRepeatStart(s, 0, false), 2, null), 2, []);
    expect(cleared.bars.every((b) => !b.repeatStart && !b.repeatEnd && !b.endings?.length)).toBe(true);
  });
});

describe('copy, paste and delete bars', () => {
  it('copies bars and pastes them after a bar with fresh ids', () => {
    const s0 = abcd();
    const clip = copyBars(s0, [0, 1]);
    const s = pasteBars(s0, 3, clip);
    expect(order(s)).toEqual(['A', 'B', 'C', 'D', 'A', 'B']);
    expect(new Set(s.bars.map((b) => b.id)).size).toBe(6);
    expect(s.bars[4]!.events[0]!.id).not.toBe(s.bars[0]!.events[0]!.id);
  });

  it('pastes at the start with -1', () => {
    const s0 = abcd();
    expect(order(pasteBars(s0, -1, copyBars(s0, [3])))).toEqual(['D', 'A', 'B', 'C', 'D']);
  });

  it('pasted bars keep their own time signature', () => {
    const waltz = setTimeSignatureFrom(abcd(), 3, { beats: 3, unit: 4 }); // D in 3/4
    const s = pasteBars(waltz, 0, copyBars(waltz, [3]));
    expect([0, 1, 2].map((i) => barTimeSignature(s, i).beats)).toEqual([4, 3, 4]);
  });

  it('pastes into another song', () => {
    const clip = copyBars(abcd(), [2]);
    expect(order(pasteBars(createSong(), -1, clip))).toEqual(['C']);
  });

  it('deletes several bars, keeping the rest of the meter intact', () => {
    const s0 = setTimeSignatureFrom(abcd(), 2, { beats: 3, unit: 4 }); // C, D in 3/4
    const s = deleteBars(s0, [0, 2]);
    expect(order(s)).toEqual(['B', 'D']);
    expect(barTimeSignature(s, 1).beats).toBe(3);
  });
});
