// @vitest-environment node
import * as at from '@coderline/alphatab';
import { exportGuitarPro, exportMidi, exportMusicXml, exportSongFile, importFile } from './convert';
import { songFromLink, songToLink } from './link';
import { addChord, createSong, setHitStyle, setLyrics, setTimeSignatureFrom, type ChordHit, type Song } from '../song/song';
import { setRepeatEnd, setRepeatStart, setSection } from '../song/structure';
import { shapeFromFrets, toFretString } from '../music/chordShape';

const add = (s: Song, symbol: string, frets: string, units?: number) => addChord(s, { symbol, shape: shapeFromFrets(frets) }, units);

function demo(): Song {
  let s = createSong({ title: 'Demo', tempo: 100 });
  s = add(add(s, 'G', '320003', 16), 'C', 'x32010', 16);
  s = add(add(s, 'D', 'xx0232', 8), 'Em', '022000', 24);
  s = setLyrics(s, s.bars[0]!.id, 'Hello there');
  s = setTimeSignatureFrom(add(s, 'G', '320003'), 2, { beats: 3, unit: 4 });
  s = setHitStyle(s, s.bars[1]!.events[0]!.id, { direction: 'up' });
  return { ...s, key: 'G' };
}

const hitsOf = (s: Song) => s.bars.flatMap((b) => b.events).filter((e): e is ChordHit => e.kind === 'chord');
const picture = (s: Song) => s.bars.map((b) => b.events.map((e) => (e.kind === 'rest' ? `r${e.units}` : `${(e as ChordHit).symbol}${e.units}`)).join(' ')).join(' | ');
const fileOf = (name: string, bytes: Uint8Array | string) => ({ name, bytes: typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes });

describe('Guitar Pro', () => {
  it('exports a .gp file alphaTab can read back, and imports it as an editable song', () => {
    const bytes = exportGuitarPro(demo());
    const score = at.importer.ScoreLoader.loadScoreFromBytes(bytes, new at.Settings());
    expect(score.title).toBe('Demo');
    const song = importFile(fileOf('demo.gp', bytes));
    expect(picture(song)).toBe(picture(demo()));
    expect(song.bars[0]!.lyrics).toBe('Hello there');
    expect(song.tempo).toBe(100);
    expect(toFretString(hitsOf(song)[1]!.shape)).toBe('x32010');
    expect(hitsOf(song)[2]!.direction).toBe('up');
  });
});

describe('MusicXML', () => {
  it('exports MusicXML with chord symbols, time signatures and lyrics that alphaTab can read', () => {
    const xml = exportMusicXml(demo());
    expect(xml).toContain('<score-partwise');
    expect(xml).toContain('<harmony>');
    const score = at.importer.ScoreLoader.loadScoreFromBytes(new TextEncoder().encode(xml), new at.Settings());
    expect(score.masterBars).toHaveLength(3);
    expect(score.masterBars[2]!.timeSignatureNumerator).toBe(3);
  });

  it('imports its own MusicXML back with the same rhythm and chord names', () => {
    const song = importFile(fileOf('demo.musicxml', exportMusicXml(demo())));
    expect(picture(song)).toBe(picture(demo()));
  });

  it('writes repeats and sections', () => {
    const s = setSection(setRepeatEnd(setRepeatStart(demo(), 0, true), 1, 2), 0, 'Verse');
    const xml = exportMusicXml(s);
    expect(xml).toContain('<repeat direction="forward"/>');
    expect(xml).toContain('<repeat direction="backward" times="2"/>');
    expect(xml).toContain('<rehearsal>Verse</rehearsal>');
  });
});

describe('MIDI', () => {
  it('exports a standard MIDI file', () => {
    const bytes = exportMidi(demo());
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
  });
});

describe('song file', () => {
  it('round-trips losslessly (with a fresh id so it never overwrites the original)', () => {
    const original = demo();
    const back = importFile(fileOf('demo.guitarcords.json', exportSongFile(original)));
    expect({ ...back, id: original.id, updatedAt: original.updatedAt }).toEqual(original);
    expect(back.id).not.toBe(original.id);
  });

  it('rejects files it cannot read', () => {
    expect(() => importFile(fileOf('notes.txt', 'hello'))).toThrow(/can't open/i);
  });
});

describe('share links', () => {
  it('packs a song into a link and unpacks it', () => {
    const link = songToLink(demo(), 'https://example.com/app/');
    expect(link.startsWith('https://example.com/app/#song=')).toBe(true);
    const back = songFromLink(link)!;
    expect(picture(back)).toBe(picture(demo()));
    expect(back.title).toBe('Demo');
  });

  it('ignores links without a song', () => {
    expect(songFromLink('https://example.com/app/')).toBeNull();
    expect(songFromLink('https://example.com/app/#song=garbage')).toBeNull();
  });
});
