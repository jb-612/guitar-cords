/**
 * Song canvas: title, key (with a suggestion from the chord sequence), and the
 * bars in order — each with its chords and a lyric line — ending in "Add chord".
 */
import { ChordThumb } from '../components/ChordThumb';
import { KeySelect } from '../components/KeySelect';
import { ChordSymbol } from '../editor/ChordSymbol';
import { NowPlaying } from '../player/NowPlaying';
import type { BarRange } from '../player/engine';
import type { Player } from '../player/usePlayer';
import { ViewSwitch } from '../player/ViewSwitch';
import { setLyrics, suggestedKey, type Bar, type Song } from './song';
import './SongScreen.css';

type Update = (fn: (s: Song) => Song) => void;

interface Props {
  song: Song;
  update: Update;
  player: Player;
  onAddChord: () => void;
  onChordTap: (chordId: string) => void;
}

export function SongScreen({ song, update, player, onAddChord, onChordTap }: Props) {
  const { view } = player.settings;
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
      <ViewSwitch value={view} onChange={player.setView} />
      {view === 'chords' && <ChordView song={song} update={update} player={player} onAddChord={onAddChord} onChordTap={onChordTap} />}
      <ScoreHost attach={player.attachHost} hidden={view === 'chords'} />
    </main>
  );
}

/** Where the engine draws tab/score. Always mounted (off-screen in chord view) so playback works from any view. */
function ScoreHost({ attach, hidden }: { attach: (el: HTMLDivElement | null) => void; hidden: boolean }) {
  const cls = hidden ? ' is-hidden' : '';
  return (
    <div className={`score-scroll${cls}`}>
      <div ref={attach} data-testid="score-host" className={`score-host${cls}`} />
    </div>
  );
}

function ChordView({ song, update, player, onAddChord, onChordTap }: Props) {
  const { position, settings, section } = player;
  return (
    <>
      {position && <NowPlaying song={song} position={position} hideFingers={settings.hideFingers} />}
      <ol className={`bars${section.picking ? ' is-picking' : ''}`} aria-label="Bars">
        {song.bars.map((bar, i) => (
          <BarCard
            key={bar.id}
            bar={bar}
            index={i}
            beatsPerBar={song.beatsPerBar}
            update={update}
            onChordTap={onChordTap}
            marks={barMarks(i, position?.bar, settings.range, section.anchor)}
            onPick={section.picking ? () => section.pickBar(i) : undefined}
          />
        ))}
        <li className="bar add-bar">
          <button type="button" className="add-chord" onClick={onAddChord}>
            <span className="add-plus" aria-hidden="true">＋</span>
            <span>Add chord</span>
          </button>
        </li>
      </ol>
      {song.bars.length === 0 && <p className="song-empty">Start your progression — pick a chord from the library or draw your own.</p>}
    </>
  );
}

interface BarMarks {
  current: boolean;
  inRange: boolean;
  anchor: boolean;
}

const barMarks = (i: number, currentBar: number | undefined, range: BarRange | null, anchor: number | null): BarMarks => ({
  current: currentBar === i,
  inRange: !!range && i >= range.from && i <= range.to,
  anchor: anchor === i,
});

const markClasses = (m: BarMarks) => ['bar', m.current ? 'is-current' : '', m.inRange ? 'in-range' : '', m.anchor ? 'is-anchor' : ''].join(' ');

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
  marks: BarMarks;
  /** Present while picking a loop section. */
  onPick?: () => void;
}

function BarCard({ bar, index, beatsPerBar, update, onChordTap, marks, onPick }: BarProps) {
  const n = index + 1;
  return (
    <li
      className={markClasses(marks)}
      aria-label={`Bar ${n}`}
      aria-current={marks.current ? 'true' : undefined}
      style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
    >
      {onPick && <button type="button" className="bar-pick" aria-label={`Select bar ${n}`} onClick={onPick} />}
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
