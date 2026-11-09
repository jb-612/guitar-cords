import {
  addChord,
  barTimeSignature,
  chordSymbols,
  createSong,
  deleteBar,
  duplicateBar,
  moveHit,
  replaceHit,
  sameVoicingCount,
  fillRest,
  findEvent,
  insertBar,
  migrateSong,
  removeEvent,
  repeatHit,
  replaceVoicing,
  setHitStyle,
  setLength,
  setLyrics,
  setTempoFrom,
  setTimeSignatureFrom,
  suggestedKey,
  tempoAt,
  type Song,
  type SongEvent,
} from './song';
import { barUnits } from './rhythm';
import { shapeFromFrets } from '../music/chordShape';

const chord = (symbol: string, frets = 'x32010') => ({ symbol, shape: shapeFromFrets(frets) });
const add = (song: Song, symbol: string, units?: number) => addChord(song, chord(symbol), units);
const addAll = (song: Song, symbols: string[], units?: number) => symbols.reduce((s, sym) => add(s, sym, units), song);

/** Compact picture of the song: "G8 C8 r16 | D32" (symbol or r, then units). */
const picture = (song: Song) =>
  song.bars.map((b) => b.events.map((e: SongEvent) => `${e.kind === 'rest' ? 'r' : e.symbol}${e.units}`).join(' ')).join(' | ');

const QUARTER = 8;
const HALF = 16;

/** Every bar adds up exactly to its time signature. */
function expectFullBars(song: Song) {
  song.bars.forEach((b, i) => expect(b.events.reduce((n, e) => n + e.units, 0)).toBe(barUnits(barTimeSignature(song, i))));
}

describe('createSong', () => {
  it('defaults to 4/4 at 90 bpm with no bars and no key', () => {
    expect(createSong()).toMatchObject({ title: 'Untitled song', timeSignature: { beats: 4, unit: 4 }, tempo: 90, bars: [], key: null });
  });

  it('takes title, time signature and tempo from the setup', () => {
    const s = createSong({ title: 'Waltz', timeSignature: { beats: 3, unit: 4 }, tempo: 120 });
    expect(s).toMatchObject({ title: 'Waltz', timeSignature: { beats: 3, unit: 4 }, tempo: 120 });
  });
});

describe('adding chords keeps bars full', () => {
  it('a chord with no length fills the rest of the bar', () => {
    expect(picture(addAll(createSong(), ['G', 'C']))).toBe('G32 | C32');
  });

  it('after a half-bar chord, the next chord fills the other half (no empty gap)', () => {
    const s = add(add(createSong(), 'G', HALF), 'C');
    expect(picture(s)).toBe('G16 C16');
  });

  it('a short chord leaves an explicit rest for the rest of the bar', () => {
    const s = add(createSong(), 'G', QUARTER);
    expect(picture(s)).toBe('G8 r24');
    expectFullBars(s);
  });

  it('starts a new bar when the chord does not fit in what is left', () => {
    const s = add(add(createSong(), 'G', 24), 'C', HALF);
    expect(picture(s)).toBe('G24 r8 | C16 r16');
  });

  it('fills a whole bar in 3/4 and in 6/8', () => {
    expect(picture(add(createSong({ timeSignature: { beats: 3, unit: 4 } }), 'G'))).toBe('G24');
    expect(picture(add(createSong({ timeSignature: { beats: 6, unit: 8 } }), 'G'))).toBe('G24');
  });

  it('gives new hits sensible defaults: strum, let ring, down on the beat, up off it', () => {
    const s = add(add(createSong(), 'G', 4), 'G', 4);
    const [a, b] = s.bars[0]!.events as Extract<SongEvent, { kind: 'chord' }>[];
    expect(a).toMatchObject({ style: 'strum', sustain: 'ring', direction: 'down' });
    expect(b!.direction).toBe('up');
  });
});

describe('fillRest', () => {
  it('puts a chord into a rest slot, filling it by default', () => {
    const s0 = add(createSong(), 'G', QUARTER);
    const rest = s0.bars[0]!.events[1]!;
    expect(picture(fillRest(s0, rest.id, chord('C')))).toBe('G8 C24');
  });

  it('fills only part of the rest when a length is given', () => {
    const s0 = add(createSong(), 'G', QUARTER);
    expect(picture(fillRest(s0, s0.bars[0]!.events[1]!.id, chord('C'), QUARTER))).toBe('G8 C8 r16');
  });
});

describe('setLength (the rest of the bar re-flows)', () => {
  it('shortening leaves a rest right after the chord', () => {
    const s0 = addAll(createSong(), ['G']);
    expect(picture(setLength(s0, s0.bars[0]!.events[0]!.id, QUARTER))).toBe('G8 r24');
  });

  it('lengthening takes time from the rest that follows', () => {
    const s0 = add(createSong(), 'G', QUARTER);
    expect(picture(setLength(s0, s0.bars[0]!.events[0]!.id, HALF))).toBe('G16 r16');
  });

  it('lengthening into the next chord shortens it (and removes it if fully covered)', () => {
    const s0 = add(add(add(createSong(), 'G', QUARTER), 'C', QUARTER), 'D', HALF);
    const g = s0.bars[0]!.events[0]!.id;
    expect(picture(setLength(s0, g, 12))).toBe('G12 C4 D16');
    expect(picture(setLength(s0, g, 24))).toBe('G24 D8');
  });

  it('never runs past the end of the bar', () => {
    const s0 = add(createSong(), 'G', QUARTER);
    expect(picture(setLength(s0, s0.bars[0]!.events[0]!.id, 64))).toBe('G32');
  });

  it('merges neighbouring rests', () => {
    const s0 = add(add(createSong(), 'G', QUARTER), 'C', QUARTER); // G8 C8 r16
    const c = s0.bars[0]!.events[1]!.id;
    expect(picture(removeEvent(s0, c))).toBe('G8 r24');
  });
});

describe('hit properties', () => {
  it('sets direction, style and sustain', () => {
    const s0 = add(createSong(), 'G');
    const id = s0.bars[0]!.events[0]!.id;
    const s = setHitStyle(s0, id, { direction: 'up', style: 'arpeggio', sustain: 'cut' });
    expect(findEvent(s, id)?.event).toMatchObject({ direction: 'up', style: 'arpeggio', sustain: 'cut' });
  });
});

describe('repeatHit (quick strumming patterns)', () => {
  it('adds a copy right after, taking time from what follows', () => {
    const s0 = add(createSong(), 'G', QUARTER);
    const s = repeatHit(s0, s0.bars[0]!.events[0]!.id);
    expect(picture(s)).toBe('G8 G8 r16');
  });

  it('repeating the same hit again inserts another copy, pushing later hits on (time comes from rests first)', () => {
    const s0 = add(createSong(), 'G', QUARTER);
    const id = s0.bars[0]!.events[0]!.id;
    expect(picture(repeatHit(repeatHit(s0, id), id))).toBe('G8 G8 G8 r8');
    const withC = add(add(createSong(), 'G', QUARTER), 'C', QUARTER); // G8 C8 r16
    expect(picture(repeatHit(withC, withC.bars[0]!.events[0]!.id))).toBe('G8 G8 C8 r8');
  });

  it('the copy strums in the natural direction for where it lands', () => {
    const s0 = add(createSong(), 'G', 4);
    const s = repeatHit(s0, s0.bars[0]!.events[0]!.id);
    expect((s.bars[0]!.events[1] as { direction: string }).direction).toBe('up');
  });

  it('starts a new bar when the hit already ends the bar', () => {
    const s0 = add(createSong(), 'G');
    expect(picture(repeatHit(s0, s0.bars[0]!.events[0]!.id))).toBe('G32 | G32');
  });
});

describe('moveHit (drag and drop)', () => {
  const song3 = () => add(add(add(createSong(), 'G', QUARTER), 'C', QUARTER), 'D'); // G8 C8 D16
  const ids = (s: Song) => s.bars.flatMap((b) => b.events.map((e) => e.id));

  it('moves a chord into a rest, leaving a rest where it was', () => {
    const s0 = add(add(createSong(), 'G', QUARTER), 'C'); // G8 C24 -> make a rest in bar 2
    const s1 = insertBar(s0, 1); // G8 C24 | r32
    const g = s1.bars[0]!.events[0]!.id;
    const rest = s1.bars[1]!.events[0]!.id;
    expect(picture(moveHit(s1, g, rest))).toBe('r8 C24 | G8 r24');
  });

  it('keeps the moved hit\'s strum settings', () => {
    const s0 = insertBar(add(createSong(), 'G', QUARTER), 1);
    const g = s0.bars[0]!.events[0]!.id;
    const s1 = setHitStyle(s0, g, { direction: 'up', style: 'arpeggio' });
    const moved = moveHit(s1, g, s1.bars[1]!.events[0]!.id);
    expect(moved.bars[1]!.events[0]).toMatchObject({ symbol: 'G', direction: 'up', style: 'arpeggio' });
  });

  it('dropped on another chord, the two chords swap and each slot keeps its rhythm', () => {
    const s0 = song3();
    const [g, , d] = ids(s0);
    expect(picture(moveHit(s0, g!, d!))).toBe('D8 C8 G16');
  });

  it('copy mode leaves the original in place', () => {
    const s0 = insertBar(add(createSong(), 'G', QUARTER), 1);
    const g = s0.bars[0]!.events[0]!.id;
    expect(picture(moveHit(s0, g, s0.bars[1]!.events[0]!.id, { copy: true }))).toBe('G8 r24 | G8 r24');
    const s1 = song3();
    const [g1, , d1] = ids(s1);
    expect(picture(moveHit(s1, g1!, d1!, { copy: true }))).toBe('G8 C8 G16');
  });

  it('works within one bar, including into the rest next to it', () => {
    const s0 = add(createSong(), 'G', QUARTER); // G8 r24
    const [g, rest] = ids(s0);
    expect(picture(moveHit(s0, g!, rest!))).toBe('r8 G8 r16');
  });

  it('ignores drops on itself or on unknown targets', () => {
    const s0 = song3();
    const [g] = ids(s0);
    expect(moveHit(s0, g!, g!)).toBe(s0);
    expect(moveHit(s0, g!, 'nope')).toBe(s0);
  });
});

describe('replaceHit (one hit only, e.g. a bass walk)', () => {
  it('changes just that hit, not others with the same fingering', () => {
    const s0 = add(add(add(createSong(), 'G', QUARTER), 'G', QUARTER), 'G', HALF);
    const second = s0.bars[0]!.events[1]!.id;
    const s = replaceHit(s0, second, chord('G/F#', '2x0003'));
    expect(chordSymbols(s)).toEqual(['G', 'G/F#', 'G']);
  });

  it('counts the other hits that share a fingering', () => {
    const s0 = add(add(add(createSong(), 'G', QUARTER), 'G', QUARTER), 'C', HALF);
    expect(sameVoicingCount(s0, s0.bars[0]!.events[0]!.id)).toBe(1);
    expect(sameVoicingCount(s0, s0.bars[0]!.events[2]!.id)).toBe(0);
  });
});

describe('duplicateBar', () => {
  it('inserts a copy right after, with new ids and the same chords and lyrics', () => {
    const s0 = add(add(createSong(), 'G', HALF), 'C');
    const s1 = setLyrics(s0, s0.bars[0]!.id, 'again');
    const s = duplicateBar(s1, 0);
    expect(picture(s)).toBe('G16 C16 | G16 C16');
    expect(s.bars[1]!.lyrics).toBe('again');
    expect(s.bars[1]!.id).not.toBe(s.bars[0]!.id);
    expect(s.bars[1]!.events[0]!.id).not.toBe(s.bars[0]!.events[0]!.id);
  });

  it('the copy does not repeat a meter or tempo change', () => {
    const s0 = setTempoFrom(setTimeSignatureFrom(addAll(createSong(), ['G', 'C']), 1, { beats: 3, unit: 4 }), 1, 120);
    const s = duplicateBar(s0, 1);
    expect(s.bars[2]).toMatchObject({ timeSignature: undefined, tempo: undefined });
    expect(barTimeSignature(s, 2)).toEqual({ beats: 3, unit: 4 });
  });
});

describe('replaceVoicing', () => {
  it('changes every hit with the same name and fingering', () => {
    const s0 = add(add(add(createSong(), 'G', QUARTER), 'G', QUARTER), 'C', HALF);
    const s = replaceVoicing(s0, s0.bars[0]!.events[0]!.id, chord('G', '320033'));
    const frets = s.bars[0]!.events.filter((e) => e.kind === 'chord' && e.symbol === 'G').map((e) => e.kind === 'chord' && e.shape.dots.length);
    expect(frets).toEqual([4, 4]);
  });
});

describe('time signature changes', () => {
  it('changes the meter from a bar onwards, resizing those bars', () => {
    const s0 = addAll(createSong(), ['G', 'C', 'D']);
    const s = setTimeSignatureFrom(s0, 1, { beats: 3, unit: 4 });
    expect(picture(s)).toBe('G32 | C24 | D24');
    expectFullBars(s);
  });

  it('stops at the next change', () => {
    const s0 = addAll(createSong(), ['G', 'C', 'D', 'E']);
    const s1 = setTimeSignatureFrom(s0, 2, { beats: 2, unit: 4 });
    const s = setTimeSignatureFrom(s1, 1, { beats: 3, unit: 4 });
    expect(picture(s)).toBe('G32 | C24 | D16 | E16');
  });

  it('growing a bar adds a rest; shrinking trims rests before chords', () => {
    const s0 = add(createSong(), 'G', HALF); // G16 r16
    expect(picture(setTimeSignatureFrom(s0, 0, { beats: 5, unit: 4 }))).toBe('G16 r24');
    expect(picture(setTimeSignatureFrom(s0, 0, { beats: 2, unit: 4 }))).toBe('G16');
  });

  it('a change at bar 1 sets the song meter; a change back to the same meter removes the marker', () => {
    const s0 = addAll(createSong(), ['G', 'C']);
    expect(setTimeSignatureFrom(s0, 0, { beats: 6, unit: 8 }).timeSignature).toEqual({ beats: 6, unit: 8 });
    const marked = setTimeSignatureFrom(s0, 1, { beats: 3, unit: 4 });
    expect(setTimeSignatureFrom(marked, 1, { beats: 4, unit: 4 }).bars[1]!.timeSignature).toBeUndefined();
  });
});

describe('tempo changes', () => {
  it('sets a tempo from a bar onwards', () => {
    const s = setTempoFrom(addAll(createSong(), ['G', 'C', 'D']), 1, 120);
    expect([0, 1, 2].map((i) => tempoAt(s, i))).toEqual([90, 120, 120]);
  });

  it('bar 1 changes the song tempo; null removes a change', () => {
    const s0 = addAll(createSong(), ['G', 'C']);
    expect(setTempoFrom(s0, 0, 70).tempo).toBe(70);
    expect(tempoAt(setTempoFrom(setTempoFrom(s0, 1, 140), 1, null), 1)).toBe(90);
  });
});

describe('bars', () => {
  it('inserts an empty bar in the meter of that position', () => {
    const s0 = setTimeSignatureFrom(addAll(createSong(), ['G', 'C']), 1, { beats: 3, unit: 4 });
    expect(picture(insertBar(s0, 2))).toBe('G32 | C24 | r24');
  });

  it('deleting a bar that starts a change hands the change to the next bar', () => {
    const s0 = setTimeSignatureFrom(addAll(createSong(), ['G', 'C', 'D']), 1, { beats: 3, unit: 4 });
    const s = deleteBar(s0, 1);
    expect(picture(s)).toBe('G32 | D24');
    expect(barTimeSignature(s, 1)).toEqual({ beats: 3, unit: 4 });
  });
});

describe('lyrics, symbols and key', () => {
  it('sets a bar lyric line', () => {
    const s = addAll(createSong(), ['G']);
    expect(setLyrics(s, s.bars[0]!.id, 'Hello').bars[0]!.lyrics).toBe('Hello');
  });

  it('lists the chord sequence without repeating a held chord', () => {
    const s = add(add(add(createSong(), 'G', QUARTER), 'G', QUARTER), 'C', HALF);
    expect(chordSymbols(s)).toEqual(['G', 'C']);
  });

  it('suggests a key from 3+ chords', () => {
    expect(suggestedKey(addAll(createSong(), ['G', 'C', 'D', 'G']))?.name).toBe('G');
    expect(suggestedKey(addAll(createSong(), ['G', 'C']))).toBeNull();
  });
});

describe('migrateSong (songs saved before rhythm editing)', () => {
  it('turns beat-based bars into full bars of units, keeping chords and lyrics', () => {
    const old = {
      id: 'x', title: 'Old', key: 'G', tempo: 100, beatsPerBar: 4,
      bars: [
        { id: 'b1', lyrics: 'hi', chords: [{ id: 'c1', symbol: 'G', shape: shapeFromFrets('320003'), beats: 2 }] },
        { id: 'b2', lyrics: '', chords: [{ id: 'c2', symbol: 'C', shape: shapeFromFrets('x32010'), beats: 4 }] },
      ],
    };
    const s = migrateSong(old)!;
    expect(picture(s)).toBe('G16 r16 | C32');
    expect(s.bars[0]!.lyrics).toBe('hi');
    expect(s.timeSignature).toEqual({ beats: 4, unit: 4 });
    expect(s.tempo).toBe(100);
  });

  it('passes current songs through unchanged', () => {
    const s = addAll(createSong(), ['G']);
    expect(migrateSong(s)).toEqual(s);
  });

  it('returns null for things that are not songs', () => {
    expect(migrateSong({ nope: true })).toBeNull();
  });
});
