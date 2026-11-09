/**
 * Song -> alphaTex, alphaTab's text format. One alphaTab bar per song bar. Each chord
 * hit becomes one note (dotted, or several tied notes, when its length needs it) with
 * its strum/arpeggio direction and let-ring or cut-off; rests likewise. Time signature
 * and tempo changes are written at the bar where they start. Bar lyric lines sit on
 * the first strum of their bar.
 *
 * alphaTex rules this relies on (checked by the tests through alphaTab's own parser):
 * - notes are `fret.string` with string 1 = high E; `\chord` lists frets high E first
 * - beat effects: `d` dotted, `bd`/`bu` strum down/up, `ad`/`au` arpeggio down/up
 * - note effects: `lr` let ring, `st` staccato (cut off), `t` tied to the previous note
 * - in `\lyrics`, whitespace separates beats, `+` joins words in one beat; rests get none
 */
import { STRING_COUNT, toFretString, type ChordShape } from '../music/chordShape';
import { splitUnits, type NotePart } from '../song/rhythm';
import type { Bar, ChordHit, GuitarSound, Song } from '../song/song';
import { drumTrackTex, type DrumStyle } from './drums';

/** Quotes would end the alphaTex string; swap in typographic ones. */
const quoted = (text: string) => `"${text.replace(/\\/g, '/').replace(/"/g, '”')}"`;

/** One lyric "beat": words joined with `+`, and characters alphaTex treats specially neutralised. */
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

const notes = (shape: ChordShape, effect: string) => sounding(shape).map((s) => `${fretOn(shape, s)}.${STRING_COUNT - s}{${effect}}`).join(' ');

const BRUSH: Record<string, string> = { 'strum-down': 'bd', 'strum-up': 'bu', 'arpeggio-down': 'ad', 'arpeggio-up': 'au' };

const voicing = (h: ChordHit) => `${h.symbol}|${diagramFrets(h.shape)}`;
const hits = (song: Song) => song.bars.flatMap((b) => b.events).filter((e): e is ChordHit => e.kind === 'chord');

/** Diagram names must be unique: a second fingering with the same name becomes "G (2)". */
function diagramNames(song: Song): Map<string, { name: string; shape: ChordShape }> {
  const names = new Map<string, { name: string; shape: ChordShape }>();
  const used = new Map<string, number>();
  for (const h of hits(song)) {
    if (names.has(voicing(h))) continue;
    const n = (used.get(h.symbol) ?? 0) + 1;
    used.set(h.symbol, n);
    names.set(voicing(h), { name: n === 1 ? h.symbol : `${h.symbol} (${n})`, shape: h.shape });
  }
  return names;
}

const effects = (...parts: (string | false)[]) => {
  const list = parts.filter(Boolean);
  return list.length ? `{${list.join(' ')}}` : '';
};

const restTex = (units: number) => splitUnits(units).map((p) => `r.${p.value}${effects(p.dotted && 'd')}`);

/** Note effects for a hit's strum: let ring / cut off, accent, palm mute. */
const noteEffects = (hit: ChordHit) => [hit.sustain === 'ring' ? 'lr' : 'st', hit.accent && 'ac', hit.technique === 'palm' && 'pm'].filter(Boolean).join(' ');

/** A muted "chuck" deadens all six strings. */
const deadNotes = () => Array.from({ length: STRING_COUNT }, (_, s) => `x.${STRING_COUNT - s}`).join(' ');

const strumNotes = (hit: ChordHit, effect: string) => (hit.technique === 'muted' ? deadNotes() : notes(hit.shape, effect));

/** Triplet: three strums (down-up-down) in the time of two, on the note value a third of the hit's length. */
const TRIPLET_UNITS = new Set([4, 8, 16, 32]);
export const canTriplet = (units: number) => TRIPLET_UNITS.has(units);

function tripletTex(hit: ChordHit, name: string | null): string[] {
  const value = (32 / hit.units) * 2;
  const brushes = hit.direction === 'up' ? ['bu', 'bd', 'bu'] : ['bd', 'bu', 'bd'];
  return brushes.map((brush, i) => `(${strumNotes(hit, noteEffects(hit))}).${value}${effects('tu 3', i === 0 && name !== null && `ch ${quoted(name)}`, brush)}`);
}

/** A hit: first note carries the strum, chord name and articulation; the rest are tied continuations. */
function hitTex(hit: ChordHit, name: string | null): string[] {
  if (beatsOf(hit) === 0) return restTex(hit.units);
  if (hit.triplet && canTriplet(hit.units)) return tripletTex(hit, name);
  return splitUnits(hit.units).map((p: NotePart, i) =>
    i === 0
      ? `(${strumNotes(hit, noteEffects(hit))}).${p.value}${effects(p.dotted && 'd', name !== null && `ch ${quoted(name)}`, BRUSH[`${hit.style}-${hit.direction}`]!)}`
      : `(${strumNotes(hit, 't')}).${p.value}${effects(p.dotted && 'd')}`,
  );
}

/** Sounding beats a hit becomes (rests carry no lyrics in alphaTab). */
function beatsOf(hit: ChordHit): number {
  if (hit.technique !== 'muted' && sounding(hit.shape).length === 0) return 0;
  return hit.triplet && canTriplet(hit.units) ? 3 : splitUnits(hit.units).length;
}

interface Writer {
  names: Map<string, { name: string; shape: ChordShape }>;
  /** Voicing of the previous hit, to name chords only where they change. */
  previous: string | null;
  swing: boolean;
}

/** Section label, repeat signs and alternate endings at the start of a bar. */
const endingsTex = (endings?: number[]) => (endings?.length ? `\\ae (${endings.join(' ')})` : undefined);

const structureTex = (bar: Bar) => [
  bar.section ? `\\section ${quoted(bar.section)}` : undefined,
  bar.repeatStart ? '\\ro' : undefined,
  endingsTex(bar.endings),
  bar.repeatEnd ? `\\rc ${bar.repeatEnd}` : undefined,
];

function barTex(bar: Bar, w: Writer): string {
  const prefix = [...structureTex(bar), bar.timeSignature && `\\ts ${bar.timeSignature.beats} ${bar.timeSignature.unit}`, bar.tempo && `\\tempo ${bar.tempo}`, w.swing && '\\tf triplet-8th'].filter(Boolean);
  const body = bar.events.flatMap((e) => {
    if (e.kind === 'rest') return restTex(e.units);
    const changed = voicing(e) !== w.previous;
    w.previous = voicing(e);
    return hitTex(e, changed ? w.names.get(voicing(e))!.name : null);
  });
  return [...prefix, ...body].join(' ');
}

const blanks = (n: number) => Array.from({ length: Math.max(0, n) }, () => '+');

/**
 * One lyric token per sounding beat (alphaTab skips rests). With lyrics on chords, each
 * chord's lyric goes on its first beat; otherwise the bar's line goes on the first beat.
 */
function barLyrics(bar: Bar): string[] {
  const hits = bar.events.filter((e): e is ChordHit => e.kind === 'chord');
  if (hits.some((h) => h.lyric)) return hits.flatMap((h) => (beatsOf(h) ? [lyricToken(h.lyric ?? ''), ...blanks(beatsOf(h) - 1)] : []));
  const strums = hits.reduce((n, h) => n + beatsOf(h), 0);
  return strums === 0 ? [] : [lyricToken(bar.lyrics), ...blanks(strums - 1)];
}

/** Score and guitar-track metadata. */
const header = (song: Song) => [
  `\\title ${quoted(song.title)}`,
  `\\tempo ${song.tempo}`,
  '.',
  '\\track "Guitar"',
  '\\staff {score tabs}',
  `\\instrument ${INSTRUMENTS[song.sound ?? 'steel']}`,
  ...(song.capo ? [`\\capo ${song.capo}`] : []),
];

const INSTRUMENTS: Record<GuitarSound, string> = { steel: 'acousticguitarsteel', nylon: 'acousticguitarnylon', electric: 'electricguitarclean' };

export interface ExportOptions {
  /** Add a drum track in this style (it can be muted live in the player). */
  drums?: DrumStyle;
  /** Drum fill at the end of every 4-bar phrase, with a crash after it. */
  drumFills?: boolean;
  /** Finish the drums with a crash on the last downbeat. */
  drumEnding?: boolean;
}

export function songToAlphaTex(song: Song, options: ExportOptions = {}): string {
  const names = diagramNames(song);
  const writer: Writer = { names, previous: null, swing: song.swing === true };
  const body = song.bars.length ? song.bars.map((b) => barTex(b, writer)).join(' |\n') : 'r.1';
  const lyrics = song.bars.flatMap(barLyrics).join(' ');
  return [
    ...header(song),
    ...[...names.values()].map(({ name, shape }) => `\\chord ${quoted(name)} ${diagramFrets(shape)}`),
    ...(lyrics ? [`\\lyrics ${quoted(lyrics)}`] : []),
    `\\ts ${song.timeSignature.beats} ${song.timeSignature.unit}`,
    body,
    ...(options.drums ? drumTrackTex(song, options.drums, { fills: options.drumFills, ending: options.drumEnding }) : []),
  ].join('\n');
}

/** Exported for the player: which voicing a hit uses (same key = same diagram). */
export const voicingKey = (h: ChordHit) => `${h.symbol}|${toFretString(h.shape)}`;
