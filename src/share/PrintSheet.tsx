/**
 * Printable chord sheet (shown only when printing): title and details, a legend of
 * chord diagrams, then the bars with their chords above the lyrics.
 */
import { ChordThumb } from '../components/ChordThumb';
import { voicingKey } from '../player/alphaTex';
import { formatTimeSignature } from '../song/rhythm';
import type { Bar, ChordHit, Song } from '../song/song';
import { describeKey } from '../song/TransposeSheet';
import './PrintSheet.css';

const hitsOf = (bars: Bar[]) => bars.flatMap((b) => b.events).filter((e): e is ChordHit => e.kind === 'chord');

function legend(song: Song): ChordHit[] {
  const seen = new Set<string>();
  return hitsOf(song.bars).filter((h) => !seen.has(voicingKey(h)) && !!seen.add(voicingKey(h)));
}

const details = (song: Song) =>
  [song.key && describeKey(song.key), formatTimeSignature(song.timeSignature), `♩ = ${song.tempo}`, song.capo ? `Capo ${song.capo}` : null].filter(Boolean).join(' · ');

/** Chord names in a bar, placed where they start; repeats of the same chord are left out. */
function chordLabels(bar: Bar): { id: string; symbol: string; left: number }[] {
  const total = bar.events.reduce((n, e) => n + e.units, 0) || 1;
  const starts = bar.events.map((_, i) => bar.events.slice(0, i).reduce((n, e) => n + e.units, 0));
  const hits = bar.events.map((e, i) => ({ e, left: (starts[i]! / total) * 100 })).filter((x) => x.e.kind === 'chord');
  return hits
    .filter((x, i) => i === 0 || (x.e as ChordHit).symbol !== (hits[i - 1]!.e as ChordHit).symbol)
    .map((x) => ({ id: x.e.id, symbol: (x.e as ChordHit).symbol, left: x.left }));
}

function BarChords({ bar }: { bar: Bar }) {
  return (
    <div className="print-chords">
      {chordLabels(bar).map((c) => (
        <span key={c.id} style={{ left: `${c.left}%` }}>
          {c.symbol}
        </span>
      ))}
    </div>
  );
}

export function PrintSheet({ song }: { song: Song }) {
  return (
    <article className="print-sheet" data-testid="print-sheet" aria-hidden="true">
      <h1>{song.title}</h1>
      <p className="print-details">{details(song)}</p>
      <div className="print-legend">
        {legend(song).map((h) => (
          <figure key={voicingKey(h)}>
            <ChordThumb shape={h.shape} />
            <figcaption>{h.symbol}</figcaption>
          </figure>
        ))}
      </div>
      <div className="print-bars">
        {song.bars.map((b, i) => (
          <div key={b.id} className="print-bar">
            {b.section && <div className="print-section">{b.section}</div>}
            <span className="print-num">{i + 1}</span>
            <BarChords bar={b} />
            <div className="print-lyrics">{b.lyrics}</div>
          </div>
        ))}
      </div>
    </article>
  );
}
