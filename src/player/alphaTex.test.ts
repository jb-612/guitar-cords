// @vitest-environment node
import * as at from '@coderline/alphatab';
import { songToAlphaTex } from './alphaTex';
import { addChord, createSong, setHitStyle, setLyrics, setTempoFrom, setTimeSignatureFrom, type Song, type SongSetup } from '../song/song';
import { shapeFromFrets } from '../music/chordShape';

const parse = (song: Song) => at.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(song));
const staff = (song: Song) => parse(song).tracks[0]!.staves[0]!;
const beats = (song: Song, bar: number) => staff(song).bars[bar]!.voices[0]!.beats;
const add = (song: Song, symbol: string, frets: string, units?: number) => addChord(song, { symbol, shape: shapeFromFrets(frets) }, units);
const song = (setup: SongSetup = {}) => createSong(setup);

const gcd = () => add(add(add(song({ title: 'Little song' }), 'G', '320003'), 'C', 'x32010'), 'D', 'xx0232');

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

  it('makes one bar per song bar; a whole-bar chord is one whole note', () => {
    expect(staff(gcd()).bars).toHaveLength(3);
    expect(beats(gcd(), 0).map((b) => b.duration)).toEqual([at.model.Duration.Whole]);
  });

  it('strums the fretted and open strings, skipping muted ones', () => {
    const beat = beats(gcd(), 1)[0]!; // C = x32010
    const frets = Object.fromEntries(beat.notes.map((n) => [n.string, n.fret]));
    expect(frets).toEqual({ 2: 3, 3: 2, 4: 0, 5: 1, 6: 0 }); // alphaTab strings: 1 = low E
  });

  it('defines chord diagrams and names a chord only where it changes', () => {
    const s = add(add(add(song(), 'G', '320003', 8), 'G', '320003', 8), 'C', 'x32010', 16);
    expect([...staff(s).chords!.values()].map((c) => c.name)).toEqual(['G', 'C']);
    expect(beats(s, 0).map((b) => b.chord?.name ?? '')).toEqual(['G', '', 'C']);
  });

  it('writes note lengths, with dots and ties when a length needs them', () => {
    const quarterThenRest = add(song(), 'G', '320003', 8); // G8 r24
    expect(beats(quarterThenRest, 0).map((b) => [b.isRest, b.duration, b.dots])).toEqual([
      [false, at.model.Duration.Quarter, 0],
      [true, at.model.Duration.Half, 1],
    ]);
    const fiveFour = add(song({ timeSignature: { beats: 5, unit: 4 } }), 'G', '320003'); // 40 units
    const [whole, tied] = beats(fiveFour, 0);
    expect(whole!.duration).toBe(at.model.Duration.Whole);
    expect(tied!.duration).toBe(at.model.Duration.Quarter);
    expect(tied!.notes.every((n) => n.isTieDestination)).toBe(true);
  });

  it.each([
    ['strum', 'down', at.model.BrushType.BrushDown],
    ['strum', 'up', at.model.BrushType.BrushUp],
    ['arpeggio', 'down', at.model.BrushType.ArpeggioDown],
    ['arpeggio', 'up', at.model.BrushType.ArpeggioUp],
  ] as const)('%s %s', (style, direction, brush) => {
    const s0 = add(song(), 'G', '320003');
    const s = setHitStyle(s0, s0.bars[0]!.events[0]!.id, { style, direction });
    expect(beats(s, 0)[0]!.brushType).toBe(brush);
  });

  it('lets chords ring or cuts them off', () => {
    const s0 = add(song(), 'G', '320003');
    const id = s0.bars[0]!.events[0]!.id;
    expect(beats(s0, 0)[0]!.notes.every((n) => n.isLetRing)).toBe(true);
    const cut = setHitStyle(s0, id, { sustain: 'cut' });
    expect(beats(cut, 0)[0]!.notes.every((n) => n.isStaccato && !n.isLetRing)).toBe(true);
  });

  it('changes time signature and tempo mid-song', () => {
    const s = setTempoFrom(setTimeSignatureFrom(gcd(), 1, { beats: 3, unit: 4 }), 2, 140);
    const bars = parse(s).masterBars;
    expect(bars.map((b) => `${b.timeSignatureNumerator}/${b.timeSignatureDenominator}`)).toEqual(['4/4', '3/4', '3/4']);
    expect(bars[2]!.tempoAutomations[0]?.value).toBe(140);
  });

  it('puts each bar lyric line on the first strum of its bar', () => {
    const s0 = add(add(gcd(), 'E', '022100', 8), 'E', '022100', 8); // bar 4: E8 E8 r16
    const s = setLyrics(setLyrics(s0, s0.bars[0]!.id, 'Well I heard'), s0.bars[3]!.id, 'a secret chord');
    const lyric = (bar: number, beat: number) => beats(s, bar)[beat]!.lyrics?.[0]?.trim() ?? '';
    expect(lyric(0, 0)).toBe('Well I heard');
    expect(lyric(1, 0)).toBe('');
    expect(lyric(3, 0)).toBe('a secret chord');
    expect(lyric(3, 1)).toBe('');
  });

  it('keeps lyrics aligned across tied notes and rests', () => {
    const s0 = add(add(song({ timeSignature: { beats: 5, unit: 4 } }), 'G', '320003'), 'C', 'x32010', 8);
    const s = setLyrics(s0, s0.bars[1]!.id, 'hello');
    expect(beats(s, 1)[0]!.lyrics?.[0]?.trim()).toBe('hello');
  });

  it('survives quotes, hyphens and plus signs in names and lyrics', () => {
    const s0 = add(song({ title: 'Say "hi"' }), 'My "special" G', '3x4030');
    const s = setLyrics(s0, s0.bars[0]!.id, 'rock-and-roll + "more"');
    const score = parse(s);
    expect(score.title).toContain('hi');
    const beat = score.tracks[0]!.staves[0]!.bars[0]!.voices[0]!.beats[0]!;
    expect(beat.chord?.name).toContain('special');
    expect(beat.lyrics?.[0]).toContain('rock');
  });

  it('gives two different fingerings with the same name separate diagrams', () => {
    const s = add(add(song(), 'G', '320003'), 'G', '320033');
    expect(new Set([...staff(s).chords!.values()].map((c) => c.name)).size).toBe(2);
  });

  it('produces a playable empty bar for an empty song', () => {
    expect(staff(song()).bars).toHaveLength(1);
  });

  it.each([
    ['steel', 25],
    ['nylon', 24],
    ['electric', 27],
  ] as const)('plays the %s guitar sound', (sound, program) => {
    expect(parse({ ...gcd(), sound }).tracks[0]!.playbackInfo.program).toBe(program);
  });

  it('can swing the eighths', () => {
    const bars = parse({ ...gcd(), swing: true }).masterBars;
    expect(bars.every((b) => b.tripletFeel === at.model.TripletFeel.Triplet8th)).toBe(true);
    expect(parse(gcd()).masterBars[0]!.tripletFeel).toBe(at.model.TripletFeel.NoTripletFeel);
  });
});
