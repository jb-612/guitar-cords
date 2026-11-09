/**
 * Song -> alphaTex, alphaTab's text format. One alphaTab bar per song bar; each chord
 * is strummed once per beat (quarter notes, downstrokes) with its diagram attached to
 * the first strum. Bar lyric lines sit on the first beat of their bar.
 *
 * alphaTex rules this relies on (checked by the tests through alphaTab's own parser):
 * - notes are `fret.string` with string 1 = high E; `\chord` lists frets high E first
 * - in `\lyrics`, whitespace separates beats, `+` joins words in one beat, `-` splits syllables
 */
import { STRING_COUNT, type ChordShape } from '../music/chordShape';
import type { Bar, Song, SongChord } from '../song/song';

const QUARTER = 4;

/** Quotes would end the alphaTex string; swap in typographic ones. */
const quoted = (text: string) => `"${text.replace(/\\/g, '/').replace(/"/g, '”')}"`;

/** One lyric "beat": words joined with `+`, and characters that alphaTex treats specially neutralised. */
function lyricToken(text: string): string {
  const clean = text.trim().replace(/"/g, '”').replace(/\+/g, '＋').replace(/-/g, '‑');
  return clean ? clean.split(/\s+/).join('+') : '+';
}

const fretOn = (shape: ChordShape, string: number) => shape.dots.find((d) => d.string === string)?.fret ?? 0;
const sounding = (shape: ChordShape) => Array.from({ length: STRING_COUNT }, (_, s) => s).filter((s) => !shape.muted.includes(s));

/** `\chord` frets, high E first, x = muted. */
const diagramFrets = (shape: ChordShape) =>
  Array.from({ length: STRING_COUNT }, (_, i) => STRING_COUNT - 1 - i)
    .map((s) => (shape.muted.includes(s) ? 'x' : String(fretOn(shape, s))))
    .join(' ');

const strumNotes = (shape: ChordShape) => sounding(shape).map((s) => `${fretOn(shape, s)}.${STRING_COUNT - s}`);

/** Diagram names must be unique: a second fingering with the same name becomes "G (2)". */
function diagramNames(song: Song): Map<SongChord, string> {
  const byKey = new Map<string, string>();
  const used = new Map<string, number>();
  const names = new Map<SongChord, string>();
  for (const chord of song.bars.flatMap((b) => b.chords)) {
    const key = `${chord.symbol}|${diagramFrets(chord.shape)}`;
    if (!byKey.has(key)) {
      const n = (used.get(chord.symbol) ?? 0) + 1;
      used.set(chord.symbol, n);
      byKey.set(key, n === 1 ? chord.symbol : `${chord.symbol} (${n})`);
    }
    names.set(chord, byKey.get(key)!);
  }
  return names;
}

function chordBeats(chord: SongChord, name: string): string[] {
  const notes = strumNotes(chord.shape);
  const strum = notes.length ? `(${notes.join(' ')}).${QUARTER}` : `r.${QUARTER}`;
  return Array.from({ length: chord.beats }, (_, i) => `${strum}{${i === 0 ? `ch ${quoted(name)} ` : ''}bd}`);
}

const usedBeats = (bar: Bar) => bar.chords.reduce((n, c) => n + c.beats, 0);

function barTex(bar: Bar, beatsPerBar: number, names: Map<SongChord, string>): string {
  const beats = bar.chords.flatMap((c) => chordBeats(c, names.get(c)!));
  const rests = Array.from({ length: Math.max(0, beatsPerBar - usedBeats(bar)) }, () => `r.${QUARTER}`);
  return [...beats, ...rests].join(' ');
}

/**
 * Lyric tokens for the bar: the line on its first strum, blanks on the other strums.
 * alphaTab skips rests when placing lyrics, so there is exactly one token per strum.
 */
function barLyrics(bar: Bar): string[] {
  const strums = usedBeats(bar);
  return strums === 0 ? [] : [lyricToken(bar.lyrics), ...Array.from({ length: strums - 1 }, () => '+')];
}

export function songToAlphaTex(song: Song): string {
  const names = diagramNames(song);
  const diagrams = [...new Map([...names].map(([c, n]) => [n, c.shape])).entries()].map(([n, shape]) => `\\chord ${quoted(n)} ${diagramFrets(shape)}`);
  const body = song.bars.length ? song.bars.map((b) => barTex(b, song.beatsPerBar, names)).join(' |\n') : 'r.1';
  const lyrics = song.bars.flatMap(barLyrics).join(' ');
  return [
    `\\title ${quoted(song.title)}`,
    `\\tempo ${song.tempo}`,
    '.',
    '\\track "Guitar"',
    '\\staff {score tabs}',
    '\\instrument acousticguitarsteel',
    ...diagrams,
    ...(lyrics ? [`\\lyrics ${quoted(lyrics)}`] : []),
    `\\ts ${song.beatsPerBar} 4`,
    body,
  ].join('\n');
}
