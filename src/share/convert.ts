/**
 * Getting songs in and out of the app:
 * - export: Guitar Pro 7 and MIDI (through alphaTab), MusicXML (written here), song file (JSON)
 * - import: Guitar Pro (gp/gp3/gp4/gp5/gpx), MusicXML (xml/musicxml/mxl), song file
 */
import * as at from '@coderline/alphatab';
import { nameChord } from '../music/chordNaming';
import { assignFingers, STANDARD_TUNING, STRING_COUNT, type ChordShape } from '../music/chordShape';
import { parseChord } from '../music/chordSymbol';
import { songToAlphaTex, type ExportOptions } from '../player/alphaTex';
import { splitUnits, unitsOf, type NotePart, type TimeSignature } from '../song/rhythm';
import { migrateSong, normalizeSong, withMarkers, type Bar, type ChordHit, type GuitarSound, type PlacedBar, type Song, type SongEvent } from '../song/song';

const TICKS_PER_UNIT = 960 / 8;
const newId = () => crypto.randomUUID();
const settings = () => new at.Settings();
const scoreOf = (song: Song, options?: ExportOptions) => at.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(song, options));

// --- Guitar Pro & MIDI (alphaTab) -----------------------------------------

export const exportGuitarPro = (song: Song): Uint8Array => new at.exporter.Gp7Exporter().export(scoreOf(song), settings());

export function exportMidi(song: Song, options?: ExportOptions): Uint8Array {
  const midi = new at.midi.MidiFile();
  new at.midi.MidiFileGenerator(scoreOf(song, options), settings(), new at.midi.AlphaSynthMidiFileHandler(midi, true)).generate();
  return midi.toBinary();
}

// --- Song file ---------------------------------------------------------------

const SONG_FILE = 'guitar-cords-song';

export const exportSongFile = (song: Song) => JSON.stringify({ format: SONG_FILE, version: 1, song }, null, 2);

function readSongFile(text: string): Song {
  const parsed = JSON.parse(text) as { format?: string; song?: unknown };
  const song = migrateSong(parsed.format === SONG_FILE ? parsed.song : parsed);
  if (!song) throw new Error('not a song file');
  return { ...song, id: newId() };
}

// --- Import (alphaTab score -> Song) -------------------------------------------

const PROGRAM_SOUND: Record<number, GuitarSound> = { 24: 'nylon', 26: 'electric', 27: 'electric', 28: 'electric', 29: 'electric', 30: 'electric' };

/** Fretted notes of a beat -> chord shape (alphaTab strings: 1 = low E on a 6-string guitar). */
function shapeOf(beat: at.model.Beat): ChordShape {
  const played = new Map(beat.notes.map((n) => [n.string - 1, n.fret]));
  const muted = Array.from({ length: STRING_COUNT }, (_, s) => s).filter((s) => !played.has(s));
  const fretted = [...played].filter(([, fret]) => fret > 0).map(([string, fret]) => ({ string, fret }));
  return { dots: assignFingers(fretted), muted };
}

const isUp = (b: at.model.Beat) => b.brushType === at.model.BrushType.BrushUp || b.brushType === at.model.BrushType.ArpeggioUp;
const isArpeggio = (b: at.model.Beat) => b.brushType === at.model.BrushType.ArpeggioUp || b.brushType === at.model.BrushType.ArpeggioDown;
const unitsOfBeat = (b: at.model.Beat) => Math.max(1, Math.round(b.playbackDuration / TICKS_PER_UNIT));
const symbolOf = (beat: at.model.Beat, shape: ChordShape) => beat.chord?.name || nameChord(shape)[0]?.symbol || 'N.C.';

function hitOf(beat: at.model.Beat): ChordHit {
  const shape = shapeOf(beat);
  return {
    id: newId(),
    kind: 'chord',
    symbol: symbolOf(beat, shape),
    shape,
    units: unitsOfBeat(beat),
    direction: isUp(beat) ? 'up' : 'down',
    style: isArpeggio(beat) ? 'arpeggio' : 'strum',
    sustain: beat.notes.every((n) => n.isStaccato) ? 'cut' : 'ring',
  };
}

const isTieOn = (beat: at.model.Beat) => beat.notes.length > 0 && beat.notes.every((n) => n.isTieDestination);

/** A beat joins the previous event when it is a tied continuation; otherwise it starts a new one. */
const isSilent = (beat: at.model.Beat) => beat.isRest || beat.notes.length === 0;

function addBeat(events: SongEvent[], beat: at.model.Beat): SongEvent[] {
  const last = events[events.length - 1];
  if (isTieOn(beat) && last?.kind === 'chord') return [...events.slice(0, -1), { ...last, units: last.units + unitsOfBeat(beat) }];
  return [...events, isSilent(beat) ? { id: newId(), kind: 'rest', units: unitsOfBeat(beat) } : hitOf(beat)];
}

const lyricsOf = (bar: at.model.Bar) =>
  bar.voices[0]!.beats
    .flatMap((b) => b.lyrics ?? [])
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ');

const endingsOf = (flags: number) => [1, 2, 3].filter((n) => flags & (1 << (n - 1)));

/** Section, repeats and endings of a master bar, leaving out what isn't there. */
function marksOf(mb: at.model.MasterBar): Partial<Bar> {
  const marks: Partial<Bar> = {
    section: mb.section?.text,
    repeatStart: mb.isRepeatStart,
    repeatEnd: mb.repeatCount,
    endings: endingsOf(mb.alternateEndings),
  };
  // Keep only marks that are actually there (no empty strings, false, 0 or []).
  return Object.fromEntries(Object.entries(marks).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : !!v)));
}

function barOf(bar: at.model.Bar): Bar {
  return { id: newId(), lyrics: lyricsOf(bar), events: bar.voices[0]!.beats.reduce(addBeat, [] as SongEvent[]), ...marksOf(bar.masterBar) };
}

function placedOf(bar: at.model.Bar, tempo: { current: number }): PlacedBar {
  const mb = bar.masterBar;
  tempo.current = mb.tempoAutomations[0]?.value ?? tempo.current;
  const ts = { beats: mb.timeSignatureNumerator, unit: mb.timeSignatureDenominator } as TimeSignature;
  return { bar: barOf(bar), ts, tempo: tempo.current };
}

export function scoreToSong(score: at.model.Score, fallbackTitle: string): Song {
  const track = score.tracks.find((t) => !t.staves[0]!.isPercussion) ?? score.tracks[0]!;
  const staff = track.staves[0]!;
  const tempo = { current: score.tempo };
  const base: Song = {
    id: newId(),
    title: score.title || fallbackTitle,
    key: null,
    tempo: score.tempo,
    timeSignature: { beats: 4, unit: 4 },
    bars: [],
    capo: staff.capo || undefined,
    sound: PROGRAM_SOUND[track.playbackInfo.program],
    updatedAt: Date.now(),
  };
  return normalizeSong(withMarkers(base, staff.bars.map((b) => placedOf(b, tempo))));
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/\.guitarcords$/, '');

/** Open a song from a file. Throws a readable error for files it can't read. */
export function importFile(file: { name: string; bytes: Uint8Array }): Song {
  try {
    if (/\.json$/i.test(file.name)) return readSongFile(new TextDecoder().decode(file.bytes));
    return scoreToSong(at.importer.ScoreLoader.loadScoreFromBytes(file.bytes, settings()), baseName(file.name));
  } catch {
    throw new Error(`Can't open “${file.name}”. Supported: Guitar Pro (.gp, .gp3–.gp5, .gpx), MusicXML (.xml, .musicxml, .mxl) and song files (.json).`);
  }
}

// --- MusicXML export -----------------------------------------------------------

const STEPS = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const ALTERS = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const TYPES: Record<number, string> = { 1: 'whole', 2: 'half', 4: 'quarter', 8: 'eighth', 16: '16th', 32: '32nd' };
const KINDS: Record<string, string> = {
  '': 'major',
  m: 'minor',
  '7': 'dominant',
  maj7: 'major-seventh',
  m7: 'minor-seventh',
  dim: 'diminished',
  dim7: 'diminished-seventh',
  m7b5: 'half-diminished',
  aug: 'augmented',
  sus2: 'suspended-second',
  sus4: 'suspended-fourth',
  '6': 'major-sixth',
  m6: 'minor-sixth',
  '9': 'dominant-ninth',
  maj9: 'major-ninth',
  m9: 'minor-ninth',
  '5': 'power',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function pitchXml(midi: number): string {
  const pc = midi % 12;
  const alter = ALTERS[pc] ? `<alter>${ALTERS[pc]}</alter>` : '';
  return `<pitch><step>${STEPS[pc]}</step>${alter}<octave>${Math.floor(midi / 12) - 1}</octave></pitch>`;
}

function rootXml(tag: 'root' | 'bass', note: string): string {
  const alter = note.includes('#') ? 1 : note.includes('b') ? -1 : 0;
  return `<${tag}><${tag}-step>${note[0]}</${tag}-step>${alter ? `<${tag}-alter>${alter}</${tag}-alter>` : ''}</${tag}>`;
}

function harmonyXml(symbol: string): string {
  const c = parseChord(symbol);
  if (!c) return '';
  const kind = KINDS[c.type] ?? 'other';
  return `<harmony>${rootXml('root', c.root)}<kind text="${esc(c.type)}">${kind}</kind>${c.bass ? rootXml('bass', c.bass) : ''}</harmony>`;
}

/** Duration in divisions (8 per quarter = our units), note type and dot. */
const typeXml = (p: NotePart) => `<duration>${unitsOf(p.value, p.dotted)}</duration><type>${TYPES[p.value]}</type>${p.dotted ? '<dot/>' : ''}`;

interface Sounding {
  midi: number;
  string: number;
  fret: number;
}

function soundingNotes(hit: ChordHit, capo: number, tuning: readonly number[]): Sounding[] {
  return Array.from({ length: STRING_COUNT }, (_, s) => s)
    .filter((s) => !hit.shape.muted.includes(s))
    .map((s) => {
      const fret = hit.shape.dots.find((d) => d.string === s)?.fret ?? 0;
      return { midi: tuning[s]! + fret + capo, string: STRING_COUNT - s, fret };
    });
}

function tieXml(i: number, count: number) {
  const ties = [i > 0 && 'stop', i < count - 1 && 'start'].filter(Boolean) as string[];
  return {
    tie: ties.map((t) => `<tie type="${t}"/>`).join(''),
    tied: ties.map((t) => `<tied type="${t}"/>`).join(''),
  };
}

function hitXml(hit: ChordHit, capo: number, lyric: string | null, tuning: readonly number[]): string {
  const notes = soundingNotes(hit, capo, tuning);
  if (notes.length === 0) return restXml(hit.units);
  const parts = splitUnits(hit.units);
  return parts
    .map((p, i) => {
      const { tie, tied } = tieXml(i, parts.length);
      return notes
        .map((n, j) => {
          const lyricXml = lyric && i === 0 && j === 0 ? `<lyric><text>${esc(lyric)}</text></lyric>` : '';
          return `<note>${j > 0 ? '<chord/>' : ''}${pitchXml(n.midi)}${typeXml(p).replace('<type>', `${tie}<type>`)}<notations>${tied}<technical><string>${n.string}</string><fret>${n.fret}</fret></technical></notations>${lyricXml}</note>`;
        })
        .join('');
    })
    .join('');
}

const restXml = (units: number) =>
  splitUnits(units)
    .map((p) => `<note><rest/>${typeXml(p)}</note>`)
    .join('');

const timeXml = (ts: TimeSignature) => `<time><beats>${ts.beats}</beats><beat-type>${ts.unit}</beat-type></time>`;
const FIRST_ATTRIBUTES = (ts: TimeSignature) =>
  `<attributes><divisions>8</divisions><key><fifths>0</fifths></key>${timeXml(ts)}<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef></attributes>`;

/** Divisions, key, time and guitar clef in the first measure; afterwards only time-signature changes. */
function attributesXml(i: number, song: Song, bar: Bar): string {
  if (i === 0) return FIRST_ATTRIBUTES(song.timeSignature);
  return bar.timeSignature ? `<attributes>${timeXml(bar.timeSignature)}</attributes>` : '';
}

const tempoXml = (bpm: number | undefined) =>
  bpm ? `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>` : '';

const sectionXml = (label?: string) => (label ? `<direction placement="above"><direction-type><rehearsal>${esc(label)}</rehearsal></direction-type></direction>` : '');

const endingXml = (bar: Bar, type: 'start' | 'stop') => (bar.endings?.length ? `<ending number="${bar.endings.join(', ')}" type="${type}"/>` : '');
const barline = (location: string, inner: string) => (inner ? `<barline location="${location}">${inner}</barline>` : '');

const leftBarline = (bar: Bar) => barline('left', endingXml(bar, 'start') + (bar.repeatStart ? '<repeat direction="forward"/>' : ''));
const rightBarline = (bar: Bar) => barline('right', endingXml(bar, 'stop') + (bar.repeatEnd ? `<repeat direction="backward" times="${bar.repeatEnd}"/>` : ''));

function measureXml(song: Song, bar: Bar, i: number, prev: { key: string | null }): string {
  let lyric: string | null = bar.lyrics.trim() || null;
  const events = bar.events.map((e) => {
    if (e.kind === 'rest') return restXml(e.units);
    const key = `${e.symbol}|${JSON.stringify(e.shape)}`;
    const harmony = key !== prev.key ? harmonyXml(e.symbol) : '';
    prev.key = key;
    const xml = harmony + hitXml(e, song.capo ?? 0, lyric, song.tuning ?? STANDARD_TUNING);
    lyric = null;
    return xml;
  });
  const tempo = tempoXml(i === 0 ? song.tempo : bar.tempo);
  return `<measure number="${i + 1}">${leftBarline(bar)}${attributesXml(i, song, bar)}${sectionXml(bar.section)}${tempo}${events.join('')}${rightBarline(bar)}</measure>`;
}

export function exportMusicXml(song: Song): string {
  const prev = { key: null as string | null };
  const measures = song.bars.map((b, i) => measureXml(song, b, i, prev)).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    `<work><work-title>${esc(song.title)}</work-title></work>`,
    '<part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>',
    '<part id="P1">',
    measures,
    '</part>',
    '</score-partwise>',
  ].join('\n');
}
