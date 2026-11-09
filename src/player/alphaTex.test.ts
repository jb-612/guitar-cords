// @vitest-environment node
import * as at from '@coderline/alphatab';
import { songToAlphaTex } from './alphaTex';
import { addChord, createSong, setLyrics, type Song } from '../song/song';
import { shapeFromFrets } from '../music/chordShape';

const parse = (song: Song) => at.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(song));
const staff = (song: Song) => parse(song).tracks[0]!.staves[0]!;
const add = (song: Song, symbol: string, frets: string, beats?: number) => addChord(song, { symbol, shape: shapeFromFrets(frets) }, beats);

const gcd = () => add(add(add(createSong('Little song'), 'G', '320003'), 'C', 'x32010'), 'D', 'xx0232');

describe('songToAlphaTex', () => {
  it('carries title, tempo and time signature', () => {
    const score = parse({ ...gcd(), tempo: 72 });
    expect(score.title).toBe('Little song');
    expect(score.tempo).toBe(72);
    expect(score.masterBars[0]!.timeSignatureNumerator).toBe(4);
  });

  it('plays on a steel-string acoustic guitar', () => {
    expect(parse(gcd()).tracks[0]!.playbackInfo.program).toBe(25);
  });

  it('makes one bar per song bar, with one strum per beat', () => {
    const bars = staff(gcd()).bars;
    expect(bars).toHaveLength(3);
    for (const bar of bars) expect(bar.voices[0]!.beats).toHaveLength(4);
  });

  it('strums the fretted and open strings, skipping muted ones', () => {
    const beat = staff(gcd()).bars[1]!.voices[0]!.beats[0]!; // C = x32010
    expect(beat.notes).toHaveLength(5);
    // alphaTab numbers strings 1 = low E ... 6 = high E internally
    const frets = Object.fromEntries(beat.notes.map((n) => [n.string, n.fret]));
    expect(frets).toEqual({ 2: 3, 3: 2, 4: 0, 5: 1, 6: 0 });
  });

  it('defines chord diagrams and marks the first strum of each chord', () => {
    const st = staff(gcd());
    expect([...st.chords!.values()].map((c) => c.name)).toEqual(['G', 'C', 'D']);
    expect(st.bars.map((b) => b.voices[0]!.beats[0]!.chord?.name)).toEqual(['G', 'C', 'D']);
    expect(st.bars[0]!.voices[0]!.beats[1]!.chord).toBeFalsy();
  });

  it('uses downstrokes', () => {
    const beat = staff(gcd()).bars[0]!.voices[0]!.beats[0]!;
    expect(beat.brushType).toBe(at.model.BrushType.BrushDown);
  });

  it('splits a bar between half-bar chords', () => {
    const song = add(add(createSong(), 'G', '320003', 2), 'C', 'x32010', 2);
    const beats = staff(song).bars[0]!.voices[0]!.beats;
    expect(beats.map((b) => b.chord?.name ?? '')).toEqual(['G', '', 'C', '']);
  });

  it('puts each bar lyric line on the first beat of its bar', () => {
    const s0 = gcd();
    const song = setLyrics(setLyrics(s0, s0.bars[0]!.id, 'Well I heard'), s0.bars[2]!.id, 'a secret chord');
    const lyric = (bar: number, beat: number) => staff(song).bars[bar]!.voices[0]!.beats[beat]!.lyrics?.[0]?.trim() ?? '';
    expect(lyric(0, 0)).toBe('Well I heard');
    expect(lyric(0, 1)).toBe('');
    expect(lyric(1, 0)).toBe('');
    expect(lyric(2, 0)).toBe('a secret chord');
  });

  it('fills a half-empty bar with rests and keeps later lyrics on their own bar', () => {
    const s0 = add(add(createSong(), 'G', '320003', 2), 'C', 'x32010'); // bar 1: G + 2 rests; bar 2: C
    const song = setLyrics(s0, s0.bars[1]!.id, 'hello');
    const bars = staff(song).bars;
    expect(bars[0]!.voices[0]!.beats.map((b) => b.isRest)).toEqual([false, false, true, true]);
    expect(bars[1]!.voices[0]!.beats[0]!.lyrics?.[0]?.trim()).toBe('hello');
  });

  it('survives quotes, hyphens and plus signs in names and lyrics', () => {
    const s0 = add(createSong('Say "hi"'), 'My "special" G', '3x4030');
    const song = setLyrics(s0, s0.bars[0]!.id, 'rock-and-roll + "more"');
    const score = parse(song);
    expect(score.title).toContain('hi');
    const beat = score.tracks[0]!.staves[0]!.bars[0]!.voices[0]!.beats[0]!;
    expect(beat.chord?.name).toContain('special');
    expect(beat.lyrics?.[0]).toContain('rock');
    expect(beat.lyrics?.[0]).toContain('roll');
  });

  it('gives two different fingerings with the same name separate diagrams', () => {
    const song = add(add(createSong(), 'G', '320003'), 'G', '320033');
    const names = [...staff(song).chords!.values()].map((c) => c.name);
    expect(new Set(names).size).toBe(2);
  });

  it('produces a playable empty bar for an empty song', () => {
    expect(staff(createSong()).bars).toHaveLength(1);
  });
});
