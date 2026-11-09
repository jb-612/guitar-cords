/**
 * Big "now playing" card for the chord view: the current chord with its finger
 * positions (or just its name in practice mode), the bar's lyrics, and what comes next.
 */
import { ChordThumb } from '../components/ChordThumb';
import { ChordSymbol } from '../editor/ChordSymbol';
import type { Song, SongChord } from '../song/song';
import type { Position } from './usePlayer';

/** The chord sounding at `beat` within its bar, plus the next chord in the song. */
export function chordsAt(song: Song, position: Position): { current?: SongChord; next?: SongChord } {
  const all = song.bars.flatMap((b, bar) => {
    let start = 0;
    return b.chords.map((c) => {
      const entry = { chord: c, bar, start, end: start + c.beats };
      start += c.beats;
      return entry;
    });
  });
  const i = all.findIndex((e) => e.bar === position.bar && position.beat >= e.start && position.beat < e.end);
  return { current: all[i]?.chord, next: i >= 0 ? all[i + 1]?.chord : undefined };
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

function CurrentChord({ chord, hideFingers }: { chord?: SongChord; hideFingers: boolean }) {
  return (
    <div className="now-main">
      <div className="now-chord" data-testid="now-chord" aria-label={chord?.symbol ?? ''}>
        <ChordSymbol symbol={chord?.symbol} inline />
      </div>
      {hideFingers ? <p className="now-hint">Fingers hidden — play it from memory</p> : <Fingers chord={chord} />}
    </div>
  );
}

function Fingers({ chord }: { chord?: SongChord }) {
  if (!chord) return null;
  return (
    <div className="now-diagram" data-testid="now-diagram" key={chord.id}>
      <ChordThumb shape={chord.shape} />
    </div>
  );
}

const Lyrics = ({ text }: { text?: string }) => (text ? <p className="now-lyrics">{text}</p> : null);

function NextChord({ chord }: { chord?: SongChord }) {
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
