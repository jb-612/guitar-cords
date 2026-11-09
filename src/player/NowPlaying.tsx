/**
 * Big "now playing" card for the chord view: the current chord with its finger
 * positions (or just its name in practice mode), the bar's lyrics, and what comes next.
 */
import { ChordThumb } from '../components/ChordThumb';
import { ChordSymbol } from '../editor/ChordSymbol';
import type { ChordHit, Song, SongEvent } from '../song/song';
import { voicingKey } from './alphaTex';
import type { Position } from './usePlayer';

interface Timed {
  event: SongEvent;
  bar: number;
  start: number;
}

const timeline = (song: Song): Timed[] =>
  song.bars.flatMap((b, bar) => {
    let start = 0;
    return b.events.map((event) => {
      const t = { event, bar, start };
      start += event.units;
      return t;
    });
  });

const isHit = (e: SongEvent): e is ChordHit => e.kind === 'chord';

/** The chord sounding at `position` (none during a rest) and the next different chord after it. */
export function chordsAt(song: Song, position: Position): { current?: ChordHit; next?: ChordHit } {
  const all = timeline(song);
  const i = all.findIndex((t) => t.bar === position.bar && position.unit >= t.start && position.unit < t.start + t.event.units);
  const current = all[i] && isHit(all[i].event) ? all[i].event : undefined;
  const later = all.slice(i + 1).map((t) => t.event).filter(isHit);
  const next = later.find((h) => !current || voicingKey(h) !== voicingKey(current));
  return { current, next };
}

export function NowPlaying({ song, position, hideFingers }: { song: Song; position: Position; hideFingers: boolean }) {
  const { current, next } = chordsAt(song, position);
  return (
    <section className="now-playing card" aria-label="Now playing">
      <CurrentChord chord={current} hideFingers={hideFingers} />
      <div className="now-side">
        <Lyrics text={song.bars[position.bar]?.lyrics} />
        <NextChord chord={next} />
        <p className="now-bar">Bar {position.bar + 1}</p>
      </div>
    </section>
  );
}

function CurrentChord({ chord, hideFingers }: { chord?: ChordHit; hideFingers: boolean }) {
  return (
    <div className="now-main">
      <div className="now-chord" data-testid="now-chord" aria-label={chord?.symbol ?? ''}>
        <ChordSymbol symbol={chord?.symbol} inline />
      </div>
      {hideFingers ? <p className="now-hint">Fingers hidden — play it from memory</p> : <Fingers chord={chord} />}
    </div>
  );
}

function Fingers({ chord }: { chord?: ChordHit }) {
  if (!chord) return null;
  return (
    <div className="now-diagram" data-testid="now-diagram" key={chord.id}>
      <ChordThumb shape={chord.shape} />
    </div>
  );
}

const Lyrics = ({ text }: { text?: string }) => (text ? <p className="now-lyrics">{text}</p> : null);

function NextChord({ chord }: { chord?: ChordHit }) {
  if (!chord) return null;
  return (
    <p className="now-next">
      Next{' '}
      <span data-testid="next-chord" aria-label={chord.symbol}>
        <ChordSymbol symbol={chord.symbol} inline />
      </span>
    </p>
  );
}
