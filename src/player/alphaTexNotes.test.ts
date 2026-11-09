// @vitest-environment node
import * as at from '@coderline/alphatab';
import { songToAlphaTex } from './alphaTex';
import { addChord, createSong, setLyrics, type Song } from '../song/song';
import { addNotes } from '../song/notes';
import { shapeFromFrets } from '../music/chordShape';
import { exportMusicXml } from '../share/convert';

const parse = (song: Song) => at.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(song));
const beats = (song: Song, bar: number) => parse(song).tracks[0]!.staves[0]!.bars[bar]!.voices[0]!.beats;
const frets = (beat: at.model.Beat) => Object.fromEntries(beat.notes.map((n) => [n.string, n.fret]));

describe('note events in alphaTex', () => {
  it('plays riff notes on their strings, without a strum or chord name', () => {
    const s = addNotes(addNotes(createSong(), [{ string: 0, fret: 3 }], 8), [{ string: 1, fret: 2 }, { string: 2, fret: 0 }], 8);
    const [first, second] = beats(s, 0);
    expect(frets(first!)).toEqual({ 1: 3 }); // alphaTab string 1 = low E
    expect(frets(second!)).toEqual({ 2: 2, 3: 0 });
    expect(first!.duration).toBe(at.model.Duration.Quarter);
    expect(first!.brushType).toBe(at.model.BrushType.None);
    expect(first!.chordId).toBeNull();
  });

  it('ties a long note and still names the next chord', () => {
    const s = addChord(addNotes(createSong(), [{ string: 0, fret: 0 }], 20), { symbol: 'G', shape: shapeFromFrets('320003') }, 12);
    const bar = beats(s, 0);
    expect(bar[1]!.notes[0]!.isTieDestination).toBe(true);
    expect(bar.at(-2)!.chord?.name ?? bar.at(-1)!.chord?.name).toBeDefined();
  });

  it('gives bar lyrics to the first sounding note', () => {
    const s0 = addNotes(createSong(), [{ string: 0, fret: 0 }], 32);
    const s = setLyrics(s0, s0.bars[0]!.id, 'Hey');
    expect(beats(s, 0)[0]!.lyrics?.[0]).toBe('Hey');
  });
});

describe('note events in MusicXML', () => {
  it('writes the notes with string and fret, and no harmony', () => {
    const xml = exportMusicXml(addNotes(createSong(), [{ string: 0, fret: 3 }], 32));
    expect(xml).toContain('<string>6</string><fret>3</fret>');
    expect(xml).toContain('<step>G</step>');
    expect(xml).not.toContain('<harmony');
  });
});
