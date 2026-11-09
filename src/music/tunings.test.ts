// @vitest-environment node
import * as at from '@coderline/alphatab';
import { TUNINGS, isStandard, tuningById, tuningTex } from './tunings';
import { nameChord } from './chordNaming';
import { shapeFromFrets } from './chordShape';
import { songToAlphaTex } from '../player/alphaTex';
import { exportMusicXml } from '../share/convert';
import { addChord, createSong } from '../song/song';

const DROP_D = tuningById('drop-d').notes;

describe('tunings', () => {
  it('offers the common alternate tunings', () => {
    expect(TUNINGS.map((t) => t.name)).toEqual(['Standard (EADGBE)', 'Drop D (DADGBE)', 'Half-step down (E♭)', 'DADGAD', 'Open G (DGDGBD)', 'Open D (DADF♯AD)']);
    expect(isStandard(undefined)).toBe(true);
    expect(isStandard(DROP_D)).toBe(false);
  });

  it('names chords in the tuning: all strings 000232 in drop D is a D chord', () => {
    expect(nameChord(shapeFromFrets('000232'), undefined, DROP_D)[0]?.symbol).toBe('D');
  });

  it('writes the tuning for alphaTab, high string first, and playback uses it', () => {
    expect(tuningTex(DROP_D)).toBe('\\tuning (E4 B3 G3 D3 A2 D2)');
    const song = { ...addChord(createSong(), { symbol: 'D', shape: shapeFromFrets('000232') }), tuning: DROP_D };
    const staff = at.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(song)).tracks[0]!.staves[0]!;
    expect(staff.tuning).toEqual([64, 59, 55, 50, 45, 38]);
    const halfDown = { ...song, tuning: tuningById('half-down').notes };
    expect(at.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(halfDown)).tracks[0]!.staves[0]!.tuning).toEqual([63, 58, 54, 49, 44, 39]);
  });

  it('exports the real pitches to MusicXML', () => {
    const song = { ...addChord(createSong(), { symbol: 'D', shape: shapeFromFrets('000232') }), tuning: DROP_D };
    expect(exportMusicXml(song)).toContain('<pitch><step>D</step><octave>2</octave></pitch>');
  });
});
