import {
  addChord,
  chordSymbols,
  createSong,
  removeChord,
  replaceChord,
  setChordBeats,
  setLyrics,
  suggestedKey,
  type Song,
} from './song';
import { shapeFromFrets } from '../music/chordShape';

const chord = (symbol: string, frets = 'x32010') => ({ symbol, shape: shapeFromFrets(frets) });
const addAll = (song: Song, symbols: string[], beats?: number) => symbols.reduce((s, sym) => addChord(s, chord(sym), beats), song);

describe('createSong', () => {
  it('starts with no bars, 4/4, 90 bpm and no key', () => {
    const s = createSong();
    expect(s).toMatchObject({ title: 'Untitled song', bars: [], beatsPerBar: 4, tempo: 90, key: null });
  });
});

describe('addChord', () => {
  it('gives each full-length chord its own bar', () => {
    const s = addAll(createSong(), ['G', 'C']);
    expect(s.bars.map((b) => b.chords.map((c) => c.symbol))).toEqual([['G'], ['C']]);
  });

  it('puts two half-bar chords in the same bar', () => {
    const s = addAll(createSong(), ['G', 'C'], 2);
    expect(s.bars).toHaveLength(1);
    expect(s.bars[0]!.chords.map((c) => c.beats)).toEqual([2, 2]);
  });

  it('starts a new bar when the chord does not fit', () => {
    const s = addChord(addAll(createSong(), ['G'], 2), chord('C'), 4);
    expect(s.bars).toHaveLength(2);
  });
});

describe('removeChord', () => {
  it('removes the chord and drops a bar left empty without lyrics', () => {
    const s = addAll(createSong(), ['G', 'C']);
    const out = removeChord(s, s.bars[0]!.chords[0]!.id);
    expect(chordSymbols(out)).toEqual(['C']);
    expect(out.bars).toHaveLength(1);
  });

  it('keeps an emptied bar that has lyrics', () => {
    const s0 = addAll(createSong(), ['G']);
    const s = setLyrics(s0, s0.bars[0]!.id, 'Hello');
    expect(removeChord(s, s.bars[0]!.chords[0]!.id).bars).toHaveLength(1);
  });
});

describe('replaceChord', () => {
  it('replaces symbol and shape, keeping id and beats', () => {
    const s = addAll(createSong(), ['G'], 2);
    const id = s.bars[0]!.chords[0]!.id;
    const out = replaceChord(s, id, chord('Em', '022000'));
    expect(out.bars[0]!.chords[0]).toMatchObject({ id, symbol: 'Em', beats: 2 });
  });
});

describe('setChordBeats', () => {
  it('changes beats when the bar still fits', () => {
    const s = addAll(createSong(), ['G']);
    const id = s.bars[0]!.chords[0]!.id;
    expect(setChordBeats(s, id, 2).bars[0]!.chords[0]!.beats).toBe(2);
  });

  it('refuses beats that overflow the bar', () => {
    const s = addAll(createSong(), ['G', 'C'], 2);
    expect(setChordBeats(s, s.bars[0]!.chords[0]!.id, 4)).toBe(s);
  });
});

describe('setLyrics', () => {
  it('sets a bar lyric line', () => {
    const s = addAll(createSong(), ['G']);
    expect(setLyrics(s, s.bars[0]!.id, 'Hello darkness').bars[0]!.lyrics).toBe('Hello darkness');
  });
});

describe('suggestedKey', () => {
  it('suggests a key once the sequence is long enough', () => {
    expect(suggestedKey(addAll(createSong(), ['G', 'C', 'D', 'G']))?.name).toBe('G');
  });

  it('waits until there are at least 3 chords', () => {
    expect(suggestedKey(addAll(createSong(), ['G', 'C']))).toBeNull();
  });
});
