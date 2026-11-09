/**
 * Simple drum accompaniment, generated per bar from the bar's time signature.
 * Styles: basic (rock/pop backbeat), bossa nova (side-stick + shaker), swing (ride in
 * triplets). Written as an alphaTex percussion track using alphaTab's default
 * articulation names.
 */
import { barUnits, unitsOf, type TimeSignature } from '../song/rhythm';
import { barTimeSignature, type Song } from '../song/song';

export type DrumStyle = 'basic' | 'bossa' | 'swing';

export const DRUM_STYLES: { style: DrumStyle; label: string }[] = [
  { style: 'basic', label: 'Basic' },
  { style: 'bossa', label: 'Bossa nova' },
  { style: 'swing', label: 'Swing' },
];

const KICK = 'kickhit';
const SNARE = 'snarehit';
const HAT = 'hihatclosed';
const PEDAL_HAT = 'pedalhihathit';
const STICK = 'snaresidestick';
const SHAKER = 'shakerhit';
const RIDE = 'ridemiddle';

/** One drum step: the instruments struck together (empty = rest). */
type Step = string[];

interface Grid {
  steps: Step[];
  /** alphaTex duration of every step, e.g. ".8" or ".8{tu 3}". */
  duration: string;
}

const EIGHTH = '.8';
const TRIPLET_EIGHTH = '.8{tu 3}';

const eighthsIn = (ts: TimeSignature) => barUnits(ts) / unitsOf(8);
/** 6/8, 9/8, 12/8: felt in groups of three eighths. */
const isCompound = (ts: TimeSignature) => ts.unit === 8 && ts.beats % 3 === 0;
/** Eighths per felt beat: 3 in compound meters, 2 in x/4, 1 in other x/8. */
const beatLength = (ts: TimeSignature) => (isCompound(ts) ? 3 : ts.unit === 4 ? 2 : 1);

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const step = (...parts: (string | false)[]): Step => parts.filter((p): p is string => !!p);

/** Rock/pop: hi-hat eighths, kick on the strong beats, snare on the backbeats. */
function basic(ts: TimeSignature): Grid {
  const beat = beatLength(ts);
  const steps = range(eighthsIn(ts)).map((i) => {
    const onBeat = i % beat === 0;
    const beatNo = i / beat;
    const strong = onBeat && beatNo % 2 === 0;
    return step(strong && KICK, onBeat && !strong && SNARE, HAT);
  });
  return { steps, duration: EIGHTH };
}

/** Bossa nova bar of 4/4 on an eighth grid; other meters use its feel beat by beat. */
const BOSSA_KICK = [1, 0, 0, 1, 1, 0, 0, 1];
const BOSSA_STICK = [1, 0, 0, 1, 0, 0, 1, 0];

function bossa(ts: TimeSignature): Grid {
  const fourFour = ts.beats === 4 && ts.unit === 4;
  const beat = beatLength(ts);
  const steps = range(eighthsIn(ts)).map((i) => {
    const kick = fourFour ? BOSSA_KICK[i] === 1 : i % beat === 0;
    const stick = fourFour ? BOSSA_STICK[i] === 1 : i % beat === beat - 1;
    return step(kick && KICK, stick && STICK, SHAKER);
  });
  return { steps, duration: EIGHTH };
}

/** Swing: ride "ding, ding-da" in triplets with the hi-hat foot on 2 and 4 (x/4); a lilting ride in x/8. */
function swing(ts: TimeSignature): Grid {
  return ts.unit === 4 ? swingTriplets(ts) : swingEighths(ts);
}

/** x/4: each beat is three triplet eighths; the ride skips the middle one, and adds the last on backbeats. */
function swingTriplets(ts: TimeSignature): Grid {
  return { steps: range(ts.beats * 3).map(swingStep), duration: TRIPLET_EIGHTH };
}

/** Two beats of triplets: "ding ... ding-da", with the hi-hat foot on the second beat. */
const SWING_PAIR: Step[] = [[RIDE], [], [], [RIDE, PEDAL_HAT], [], [RIDE]];

const swingStep = (i: number): Step => (i === 0 ? [KICK, RIDE] : SWING_PAIR[i % SWING_PAIR.length]!);

/** x/8: ride on every eighth, hi-hat foot on each group after the first. */
function swingEighths(ts: TimeSignature): Grid {
  const beat = beatLength(ts);
  const steps = range(eighthsIn(ts)).map((i) => step(i === 0 && KICK, RIDE, i > 0 && i % beat === 0 && PEDAL_HAT));
  return { steps, duration: EIGHTH };
}

const PATTERNS: Record<DrumStyle, (ts: TimeSignature) => Grid> = { basic, bossa, swing };

const stepTex = (s: Step, duration: string) => {
  if (s.length === 0) return `r${duration}`;
  return `${s.length > 1 ? `(${s.join(' ')})` : s[0]}${duration}`;
};

function barTex(style: DrumStyle, ts: TimeSignature, change: TimeSignature | undefined): string {
  const { steps, duration } = PATTERNS[style](ts);
  const prefix = change ? `\\ts ${change.beats} ${change.unit} ` : '';
  return prefix + steps.map((s) => stepTex(s, duration)).join(' ');
}

/** alphaTex lines for a drum track matching the song bar for bar; empty when the song has no bars. */
export function drumTrackTex(song: Song, style: DrumStyle): string[] {
  if (song.bars.length === 0) return [];
  const bars = song.bars.map((b, i) => barTex(style, barTimeSignature(song, i), b.timeSignature));
  return [
    '\\track "Drums"',
    '\\instrument percussion',
    '\\articulation defaults',
    `\\ts ${song.timeSignature.beats} ${song.timeSignature.unit}`,
    bars.join(' |\n'),
  ];
}
