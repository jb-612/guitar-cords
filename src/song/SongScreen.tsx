/**
 * Song canvas: title, key and meter/tempo, the view switch, and (in chord view) the
 * bars as rhythm lanes: every hit and rest is sized by its length, rests are tappable
 * slots to fill, and each bar has a menu (button, right-click or long-press) for
 * meter/tempo changes and bar insert/delete.
 */
import { useRef, type PointerEvent } from 'react';
import { ChordThumb } from '../components/ChordThumb';
import { KeySelect } from '../components/KeySelect';
import { ChordSymbol } from '../editor/ChordSymbol';
import { voicingKey } from '../player/alphaTex';
import type { BarRange } from '../player/engine';
import { NowPlaying } from '../player/NowPlaying';
import type { Player } from '../player/usePlayer';
import { ViewSwitch } from '../player/ViewSwitch';
import { COMMON_TIME_SIGNATURES, formatTimeSignature, lengthName, shortLength, unitsOf } from './rhythm';
import { setLyrics, setTempoFrom, setTimeSignatureFrom, suggestedKey, type Bar, type ChordHit, type Song, type SongEvent } from './song';
import './SongScreen.css';

type Update = (fn: (s: Song) => Song) => void;

export interface SongScreenActions {
  onAddChord: () => void;
  onHitTap: (hitId: string) => void;
  onRestTap: (restId: string) => void;
  onBarMenu: (barIndex: number) => void;
}

interface Props extends SongScreenActions {
  song: Song;
  update: Update;
  player: Player;
}

export function SongScreen(props: Props) {
  const { song, update, player } = props;
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
      <div className="song-settings">
        <KeyRow song={song} update={update} />
        <MeterRow song={song} update={update} />
      </div>
      <ViewSwitch value={view} onChange={player.setView} />
      {view === 'chords' && <ChordView {...props} />}
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

function ChordView({ song, update, player, ...actions }: Props) {
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
            update={update}
            actions={actions}
            previous={lastHit(song.bars[i - 1])}
            marks={barMarks(i, position?.bar, settings.range, section.anchor)}
            onPick={section.picking ? () => section.pickBar(i) : undefined}
          />
        ))}
        <li className="bar add-bar">
          <button type="button" className="add-chord" onClick={actions.onAddChord}>
            <span className="add-plus" aria-hidden="true">＋</span>
            <span>Add chord</span>
          </button>
        </li>
      </ol>
      {song.bars.length === 0 && <p className="song-empty">Start your progression — pick a chord from the library or draw your own.</p>}
    </>
  );
}

const lastHit = (bar?: Bar) => bar?.events.filter((e): e is ChordHit => e.kind === 'chord').at(-1);

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

const MIN_BPM = 20;
const MAX_BPM = 300;

/** Meter and tempo at the start of the song (later changes live on bars). */
function MeterRow({ song, update }: { song: Song; update: Update }) {
  return (
    <div className="meter-row">
      <label className="mini-field">
        <span className="section-label">Time</span>
        <select
          aria-label="Time signature"
          value={formatTimeSignature(song.timeSignature)}
          onChange={(e) => update((s) => setTimeSignatureFrom(s, 0, COMMON_TIME_SIGNATURES.find((t) => formatTimeSignature(t) === e.target.value)!))}
        >
          {COMMON_TIME_SIGNATURES.map((t) => (
            <option key={formatTimeSignature(t)}>{formatTimeSignature(t)}</option>
          ))}
        </select>
      </label>
      <label className="mini-field">
        <span className="section-label">Tempo</span>
        <input
          type="number"
          aria-label="Song tempo (bpm)"
          min={MIN_BPM}
          max={MAX_BPM}
          value={song.tempo}
          onChange={(e) => {
            const bpm = Number(e.target.value);
            if (bpm >= MIN_BPM && bpm <= MAX_BPM) update((s) => setTempoFrom(s, 0, bpm));
          }}
        />
      </label>
    </div>
  );
}

const LONG_PRESS_MS = 550;

/** Press-and-hold opens the bar menu on touch screens (where there is no right-click). */
function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = () => clearTimeout(timer.current);
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      cancel();
      timer.current = setTimeout(onLongPress, LONG_PRESS_MS);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  };
}

interface BarProps {
  bar: Bar;
  index: number;
  update: Update;
  actions: SongScreenActions;
  /** Last hit of the previous bar, to know whether this bar's first chord is a change. */
  previous?: ChordHit;
  marks: BarMarks;
  /** Present while picking a loop section. */
  onPick?: () => void;
}

function BarCard({ bar, index, update, actions, previous, marks, onPick }: BarProps) {
  const n = index + 1;
  const openMenu = () => actions.onBarMenu(index);
  const longPress = useLongPress(openMenu);
  return (
    <li
      className={markClasses(marks)}
      aria-label={`Bar ${n}`}
      aria-current={marks.current ? 'true' : undefined}
      style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu();
      }}
      {...longPress}
    >
      {onPick && <button type="button" className="bar-pick" aria-label={`Select bar ${n}`} onClick={onPick} />}
      <header className="bar-head">
        <span className="bar-number" aria-hidden="true">{n}</span>
        {bar.timeSignature && <span className="bar-marker">{formatTimeSignature(bar.timeSignature)}</span>}
        {bar.tempo && <span className="bar-marker">♩ = {bar.tempo}</span>}
        <button type="button" className="bar-menu-btn" aria-label={`Bar ${n} options`} onClick={openMenu}>
          ⋯
        </button>
      </header>
      <Lane events={bar.events} previous={previous} actions={actions} />
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

const previousHit = (events: SongEvent[], i: number, fromLastBar?: ChordHit) =>
  i === 0 ? fromLastBar : events.slice(0, i).filter((x): x is ChordHit => x.kind === 'chord').at(-1);

/** The bar's events side by side, each as wide as it is long. */
function Lane({ events, previous, actions }: { events: SongEvent[]; previous?: ChordHit; actions: SongScreenActions }) {
  return (
    <div className="bar-lane">
      {events.map((e, i) => {
        if (e.kind === 'rest') return <RestSlot key={e.id} units={e.units} onTap={() => actions.onRestTap(e.id)} />;
        const before = previousHit(events, i, previous);
        return <HitSlot key={e.id} hit={e} isChange={!before || voicingKey(before) !== voicingKey(e)} onTap={() => actions.onHitTap(e.id)} />;
      })}
    </div>
  );
}

const QUARTER = unitsOf(4);
const ARROWS = { 'strum-down': '↓', 'strum-up': '↑', 'arpeggio-down': '⇣', 'arpeggio-up': '⇡' } as const;

export const hitLabel = (h: ChordHit) => `${h.symbol}, ${lengthName(h.units)}, ${h.style} ${h.direction}${h.sustain === 'cut' ? ', cut off' : ''}`;

const slotClass = (hit: ChordHit, isChange: boolean) => ['lane-slot hit', isChange && 'is-change', hit.sustain === 'cut' && 'is-cut'].filter(Boolean).join(' ');

function HitSlot({ hit, isChange, onTap }: { hit: ChordHit; isChange: boolean; onTap: () => void }) {
  return (
    <button
      type="button"
      className={slotClass(hit, isChange)}
      data-testid="bar-hit"
      data-symbol={hit.symbol}
      aria-label={hitLabel(hit)}
      style={{ flexGrow: hit.units }}
      onClick={onTap}
    >
      {isChange && <ChordSymbol symbol={hit.symbol} inline />}
      {isChange && hit.units >= QUARTER && <ChordThumb shape={hit.shape} />}
      <span className="hit-arrow" aria-hidden="true">
        {ARROWS[`${hit.style}-${hit.direction}`]}
      </span>
      <span className="hit-len" aria-hidden="true">
        {shortLength(hit.units)}
      </span>
    </button>
  );
}

function RestSlot({ units, onTap }: { units: number; onTap: () => void }) {
  return (
    <button type="button" className="lane-slot rest" data-testid="bar-rest" aria-label={`Rest, ${lengthName(units)} — add a chord here`} style={{ flexGrow: units }} onClick={onTap}>
      <span aria-hidden="true">＋</span>
      <span className="hit-len" aria-hidden="true">
        {shortLength(units)}
      </span>
    </button>
  );
}
