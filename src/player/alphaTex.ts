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
import type { Bar, ChordHit, Song } from '../song/song';

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

/** A hit: first note carries the strum, chord name and ring/cut; the rest are tied continuations. */
function hitTex(hit: ChordHit, name: string | null): string[] {
  if (sounding(hit.shape).length === 0) return restTex(hit.units);
  const sustain = hit.sustain === 'ring' ? 'lr' : 'st';
  return splitUnits(hit.units).map((p: NotePart, i) =>
    i === 0
      ? `(${notes(hit.shape, sustain)}).${p.value}${effects(p.dotted && 'd', name !== null && `ch ${quoted(name)}`, BRUSH[`${hit.style}-${hit.direction}`]!)}`
      : `(${notes(hit.shape, 't')}).${p.value}${effects(p.dotted && 'd')}`,
  );
}

interface Writer {
  names: Map<string, { name: string; shape: ChordShape }>;
  /** Voicing of the previous hit, to name chords only where they change. */
  previous: string | null;
}

function barTex(bar: Bar, w: Writer): string {
  const prefix = [bar.timeSignature && `\\ts ${bar.timeSignature.beats} ${bar.timeSignature.unit}`, bar.tempo && `\\tempo ${bar.tempo}`].filter(Boolean);
  const body = bar.events.flatMap((e) => {
    if (e.kind === 'rest') return restTex(e.units);
    const changed = voicing(e) !== w.previous;
    w.previous = voicing(e);
    return hitTex(e, changed ? w.names.get(voicing(e))!.name : null);
  });
  return [...prefix, ...body].join(' ');
}

/** One lyric token per sounding note (alphaTab skips rests): the bar's line first, blanks after. */
function barLyrics(bar: Bar): string[] {
  const strums = bar.events
    .filter((e): e is ChordHit => e.kind === 'chord' && sounding(e.shape).length > 0)
    .reduce((n, h) => n + splitUnits(h.units).length, 0);
  return strums === 0 ? [] : [lyricToken(bar.lyrics), ...Array.from({ length: strums - 1 }, () => '+')];
}

export function songToAlphaTex(song: Song): string {
  const names = diagramNames(song);
  const writer: Writer = { names, previous: null };
  const body = song.bars.length ? song.bars.map((b) => barTex(b, writer)).join(' |\n') : 'r.1';
  const lyrics = song.bars.flatMap(barLyrics).join(' ');
  return [
    `\\title ${quoted(song.title)}`,
    `\\tempo ${song.tempo}`,
    '.',
    '\\track "Guitar"',
    '\\staff {score tabs}',
    '\\instrument acousticguitarsteel',
    ...[...names.values()].map(({ name, shape }) => `\\chord ${quoted(name)} ${diagramFrets(shape)}`),
    ...(lyrics ? [`\\lyrics ${quoted(lyrics)}`] : []),
    `\\ts ${song.timeSignature.beats} ${song.timeSignature.unit}`,
    body,
  ].join('\n');
}

/** Exported for the player: which voicing a hit uses (same key = same diagram). */
export const voicingKey = (h: ChordHit) => `${h.symbol}|${toFretString(h.shape)}`;
