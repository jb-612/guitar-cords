/**
 * Song canvas: title, key (with a suggestion from the chord sequence), and the
 * bars in order — each with its chords and a lyric line — ending in "Add chord".
 */
import { ChordThumb } from '../components/ChordThumb';
import { KeySelect } from '../components/KeySelect';
import { ChordSymbol } from '../editor/ChordSymbol';
import { setLyrics, suggestedKey, type Bar, type Song } from './song';
import './SongScreen.css';

type Update = (fn: (s: Song) => Song) => void;

interface Props {
  song: Song;
  update: Update;
  onAddChord: () => void;
  onChordTap: (chordId: string) => void;
}

export function SongScreen({ song, update, onAddChord, onChordTap }: Props) {
  return (
    <main className="song">
      <input
        className="song-title"
        aria-label="Song title"
        value={song.title}
        onChange={(e) => update((s) => ({ ...s, title: e.target.value }))}
        onFocus={(e) => e.target.select()}
      />
      <KeyRow song={song} update={update} />
      <ol className="bars" aria-label="Bars">
        {song.bars.map((bar, i) => (
          <BarCard key={bar.id} bar={bar} index={i} beatsPerBar={song.beatsPerBar} update={update} onChordTap={onChordTap} />
        ))}
        <li className="bar add-bar">
          <button type="button" className="add-chord" onClick={onAddChord}>
            <span className="add-plus" aria-hidden="true">＋</span>
            <span>Add chord</span>
          </button>
        </li>
      </ol>
      {song.bars.length === 0 && <p className="song-empty">Start your progression — pick a chord from the library or draw your own.</p>}
    </main>
  );
}

function KeyRow({ song, update }: { song: Song; update: Update }) {
  const suggestion = suggestedKey(song);
  const showSuggestion = suggestion && suggestion.name !== song.key;
  return (
    <div className="key-row">
      <KeySelect value={song.key ?? ''} onChange={(k) => update((s) => ({ ...s, key: k || null }))} />
      {showSuggestion && (
        <div className="key-suggestion" role="status">
          <span>
            Sounds like <strong>{suggestion.tonic} {suggestion.mode}</strong>
          </span>
          <button
            type="button"
            className="pill-btn"
            aria-label={`Use key ${suggestion.tonic} ${suggestion.mode}`}
            onClick={() => update((s) => ({ ...s, key: suggestion.name }))}
          >
            Use
          </button>
        </div>
      )}
    </div>
  );
}

interface BarProps {
  bar: Bar;
  index: number;
  beatsPerBar: number;
  update: Update;
  onChordTap: (chordId: string) => void;
}

function BarCard({ bar, index, beatsPerBar, update, onChordTap }: BarProps) {
  const n = index + 1;
  return (
    <li className="bar" aria-label={`Bar ${n}`} style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}>
      <span className="bar-number" aria-hidden="true">{n}</span>
      <div className="bar-chords">
        {bar.chords.map((c) => (
          <button
            key={c.id}
            type="button"
            className="bar-chord"
            data-testid="bar-chord"
            aria-label={c.symbol}
            style={{ flexGrow: c.beats / beatsPerBar }}
            onClick={() => onChordTap(c.id)}
          >
            <ChordSymbol symbol={c.symbol} inline />
            <ChordThumb shape={c.shape} />
          </button>
        ))}
      </div>
      <input
        className="bar-lyrics"
        aria-label={`Lyrics for bar ${n}`}
        placeholder="lyrics…"
        value={bar.lyrics}
        onChange={(e) => update((s) => setLyrics(s, bar.id, e.target.value))}
      />
    </li>
  );
}
