import { addNotes, fillRestWithNotes, setNotes } from './notes';
import { addChord, createSong, insertBar, moveHit, removeEvent, repeatHit, setLength, type NoteEvent, type Song } from './song';
import { shapeFromFrets } from '../music/chordShape';

const picture = (s: Song) =>
  s.bars.map((b) => b.events.map((e) => (e.kind === 'rest' ? `r${e.units}` : e.kind === 'notes' ? `n[${e.notes.map((n) => `${n.string}:${n.fret}`).join(',')}]${e.units}` : `${e.symbol}${e.units}`)).join(' ')).join(' | ');

const E_ON_LOW = [{ string: 0, fret: 0 }];
const G_ON_LOW = [{ string: 0, fret: 3 }];

describe('note events (riffs and bass lines)', () => {
  it('appends single notes, filling the bar like chords do', () => {
    const s = addNotes(addNotes(createSong(), E_ON_LOW, 8), G_ON_LOW, 8);
    expect(picture(s)).toBe('n[0:0]8 n[0:3]8 r16');
  });

  it('fills a rest with notes', () => {
    const s0 = addChord(createSong(), { symbol: 'G', shape: shapeFromFrets('320003') }, 16);
    const rest = s0.bars[0]!.events[1]!.id;
    expect(picture(fillRestWithNotes(s0, rest, [{ string: 1, fret: 2 }, { string: 2, fret: 2 }], 8))).toBe('G16 n[1:2,2:2]8 r8');
  });

  it('keeps one note per string, sorted low to high', () => {
    const s0 = addNotes(createSong(), E_ON_LOW, 8);
    const id = s0.bars[0]!.events[0]!.id;
    const s = setNotes(s0, id, [{ string: 3, fret: 2 }, { string: 0, fret: 5 }, { string: 3, fret: 4 }]);
    expect((s.bars[0]!.events[0] as NoteEvent).notes).toEqual([{ string: 0, fret: 5 }, { string: 3, fret: 4 }]);
  });

  it('works with length, duplicate, move and delete like chord hits', () => {
    const s0 = addNotes(createSong(), E_ON_LOW, 8);
    const id = s0.bars[0]!.events[0]!.id;
    expect(picture(setLength(s0, id, 16))).toBe('n[0:0]16 r16');
    expect(picture(repeatHit(s0, id))).toBe('n[0:0]8 n[0:0]8 r16');
    const withBar = insertBar(s0, 1);
    expect(picture(moveHit(withBar, id, withBar.bars[1]!.events[0]!.id))).toBe('r32 | n[0:0]8 r24');
    expect(picture(removeEvent(s0, id))).toBe('r32');
  });
});

describe('transposing note events', () => {
  it('moves every note by the interval, an octave up or down when it would leave the neck', async () => {
    const { transposeSong } = await import('./transposeSong');
    const s0 = addNotes(createSong(), [{ string: 0, fret: 3 }, { string: 1, fret: 0 }], 32);
    const notesOf = (s: Song) => (s.bars[0]!.events[0] as NoteEvent).notes;
    expect(notesOf(transposeSong(s0, 2))).toEqual([{ string: 0, fret: 5 }, { string: 1, fret: 2 }]);
    expect(notesOf(transposeSong(s0, -2))).toEqual([{ string: 0, fret: 1 }, { string: 1, fret: 10 }]);
  });
});
