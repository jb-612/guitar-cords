import { addSong, createLibrary, currentSong, deleteSong, duplicateSong, migrateLibrary, openSong, renameSong, updateCurrent } from './library';
import { addChord, createSong } from '../song/song';
import { shapeFromFrets } from '../music/chordShape';

const titled = (title: string) => createSong({ title });

describe('song library', () => {
  it('starts with one empty song that is open', () => {
    const lib = createLibrary();
    expect(lib.songs).toHaveLength(1);
    expect(currentSong(lib).title).toBe('Untitled song');
  });

  it('adds a new song and opens it, keeping the others', () => {
    const lib = addSong(createLibrary(), titled('Second'));
    expect(lib.songs.map((s) => s.title)).toEqual(['Untitled song', 'Second']);
    expect(currentSong(lib).title).toBe('Second');
  });

  it('opens another song', () => {
    const lib0 = addSong(createLibrary(), titled('Second'));
    const first = lib0.songs[0]!.id;
    expect(currentSong(openSong(lib0, first)).title).toBe('Untitled song');
    expect(openSong(lib0, 'missing')).toBe(lib0);
  });

  it('updates only the open song and stamps it', () => {
    const lib0 = addSong(createLibrary(), titled('Second'));
    const lib = updateCurrent(lib0, (s) => addChord(s, { symbol: 'G', shape: shapeFromFrets('320003') }));
    expect(currentSong(lib).bars).toHaveLength(1);
    expect(lib.songs[0]!.bars).toHaveLength(0);
    expect(currentSong(lib).updatedAt).toBeGreaterThanOrEqual(currentSong(lib0).updatedAt ?? 0);
  });

  it('renames a song (blank names are ignored)', () => {
    const lib0 = createLibrary();
    const id = lib0.songs[0]!.id;
    expect(currentSong(renameSong(lib0, id, '  Wonderwall  ')).title).toBe('Wonderwall');
    expect(renameSong(lib0, id, '   ')).toBe(lib0);
  });

  it('duplicates a song as an independent copy right after it, and opens the copy', () => {
    const lib0 = updateCurrent(createLibrary(), (s) => addChord({ ...s, title: 'Tune' }, { symbol: 'G', shape: shapeFromFrets('320003') }));
    const lib = duplicateSong(lib0, lib0.songs[0]!.id);
    expect(lib.songs.map((s) => s.title)).toEqual(['Tune', 'Tune (copy)']);
    const [a, b] = lib.songs;
    expect(b!.id).not.toBe(a!.id);
    expect(b!.bars[0]!.id).not.toBe(a!.bars[0]!.id);
    expect(currentSong(lib).id).toBe(b!.id);
  });

  it('deletes a song; deleting the open one opens a neighbour; the last one is replaced by a fresh song', () => {
    const lib0 = addSong(addSong(createLibrary(), titled('B')), titled('C')); // A B C, C open
    const lib1 = deleteSong(lib0, lib0.songs[2]!.id);
    expect(lib1.songs.map((s) => s.title)).toEqual(['Untitled song', 'B']);
    expect(currentSong(lib1).title).toBe('B');
    const solo = createLibrary();
    const after = deleteSong(solo, solo.songs[0]!.id);
    expect(after.songs).toHaveLength(1);
    expect(after.songs[0]!.id).not.toBe(solo.songs[0]!.id);
  });

  it('migrates the single song saved by earlier versions', () => {
    const old = createSong({ title: 'Kept' });
    const lib = migrateLibrary(null, JSON.stringify(old));
    expect(currentSong(lib).title).toBe('Kept');
  });

  it('reads a stored library, upgrading old songs inside it, and survives junk', () => {
    const stored = JSON.stringify({ currentId: 'x', songs: [{ id: 'x', title: 'Old', key: null, tempo: 90, beatsPerBar: 4, bars: [] }] });
    expect(currentSong(migrateLibrary(stored, null)).timeSignature).toEqual({ beats: 4, unit: 4 });
    expect(migrateLibrary('{nope', null).songs).toHaveLength(1);
  });
});
