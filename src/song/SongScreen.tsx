/**
 * Song canvas: title, key and meter/tempo, the view switch, and (in chord view) the
 * bars as rhythm lanes: every hit and rest is sized by its length, rests are tappable
 * slots to fill, and each bar has a menu (button, right-click or long-press) for
 * meter/tempo changes and bar insert/delete.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { ChordThumb } from '../components/ChordThumb';
import { KeySelect } from '../components/KeySelect';
import { ChordSymbol } from '../editor/ChordSymbol';
import { voicingKey } from '../player/alphaTex';
import type { BarRange } from '../player/engine';
import { NowPlaying } from '../player/NowPlaying';
import type { Player } from '../player/usePlayer';
import { ViewSwitch } from '../player/ViewSwitch';
import { COMMON_TIME_SIGNATURES, formatTimeSignature, lengthName, shortLength, unitsOf } from './rhythm';
import { useBarDrag, type BarDragView } from './useBarDrag';
import type { BarSelection } from './useBarSelection';
import { describeKey } from './TransposeSheet';
import { MAX_CAPO, soundingKey, withCapo } from './transposeSong';
import { useHitDrag, type DragView } from './useHitDrag';
import { relativeKey, romanNumeral } from '../music/roman';
import { suggestKeys } from '../music/keyDetection';
import { chordSymbols, setLyrics, setTempoFrom, setTimeSignatureFrom, suggestedKey, type Bar, type ChordHit, type Song, type SongEvent } from './song';
import './SongScreen.css';

/** Edit the song; a `tag` merges quick repeated edits (typing) into one undo step. */
type Update = (fn: (s: Song) => Song, tag?: string) => void;

export interface SongScreenActions {
  onAddChord: () => void;
  onHitTap: (hitId: string) => void;
  onRestTap: (restId: string) => void;
  onBarMenu: (barIndex: number) => void;
  /** Drag and drop: onto a rest moves, onto a chord swaps; `copy` keeps the original. */
  onMoveHit: (fromId: string, toId: string, copy: boolean) => void;
  /** Reorder: bar `from` goes to position `to`. */
  onMoveBar: (from: number, to: number) => void;
  onTranspose: () => void;
  onPerform: () => void;
}

type Drag = ReturnType<typeof useHitDrag>;

interface Props extends SongScreenActions {
  song: Song;
  update: Update;
  player: Player;
  selection: BarSelection;
}

export function SongScreen(props: Props) {
  const { song, update, player } = props;
  const { view } = player.settings;
  const [numerals, setNumerals] = useState(false);
  const numeralKey = numerals ? song.key : null;
  return (
    <main className="song">
      <input
        className="song-title"
        aria-label="Song title"
        value={song.title}
        onChange={(e) => update((s) => ({ ...s, title: e.target.value }), 'title')}
        onFocus={(e) => e.target.select()}
      />
      <div className="song-settings">
        <KeyRow song={song} update={update} numerals={numerals} onNumerals={() => setNumerals(!numerals)} />
        <MeterRow song={song} update={update} />
        <CapoRow song={song} update={update} onTranspose={props.onTranspose} />
      </div>
      <div className="view-row">
        <ViewSwitch value={view} onChange={player.setView} />
        <button type="button" className="new-song-btn perform-btn" aria-label="Perform" onClick={props.onPerform} disabled={song.bars.length === 0}>
          <span aria-hidden="true">◉</span> Perform
        </button>
      </div>
      {view === 'chords' && <ChordView {...props} numeralKey={numeralKey} />}
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

const barIdAt = (song: Song, i: number) => song.bars[i]?.id ?? null;

function ChordView({ song, update, player, selection, numeralKey, ...actions }: Props & { numeralKey: string | null }) {
  const { position, settings, section } = player;
  const drag = useHitDrag(actions.onMoveHit);
  // After a keyboard move, focus follows the moved bar's handle.
  const [focusBar, setFocusBar] = useState<string | null>(null);
  const moveBar = (from: number, to: number) => {
    setFocusBar(barIdAt(song, from));
    actions.onMoveBar(from, to);
  };
  const barDrag = useBarDrag(actions.onMoveBar);
  return (
    <>
      <DragLayer chord={drag.view} bar={barDrag.view} />
      {position && <NowPlaying song={song} position={position} hideFingers={settings.hideFingers} />}
      <ol className={`bars${section.picking ? ' is-picking' : ''}`} aria-label="Bars">
        {song.bars.map((bar, i) => (
          <BarCard
            key={bar.id}
            bar={bar}
            index={i}
            update={update}
            actions={actions}
            drag={drag}
            reorder={{ count: song.bars.length, move: moveBar, begin: barDrag.begin, view: barDrag.view, focus: focusBar === bar.id }}
            selection={selection}
            numeralKey={numeralKey}
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
        <PasteTile selection={selection} />
      </ol>
      {selection.mode && <SelectionBar selection={selection} />}
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

function KeyRow({ song, update, numerals, onNumerals }: { song: Song; update: Update; numerals: boolean; onNumerals: () => void }) {
  return (
    <div className="key-row">
      <KeySelect value={song.key ?? ''} onChange={(k) => update((s) => ({ ...s, key: k || null }))} />
      <RelativeKey songKey={song.key} onSwitch={(key) => update((s) => ({ ...s, key }))} />
      <button type="button" className="chip-toggle numerals-toggle" aria-pressed={numerals} disabled={!song.key} onClick={onNumerals}>
        Numerals
      </button>
      <KeySuggestion song={song} onUse={(key) => update((s) => ({ ...s, key }))} />
    </div>
  );
}

/** "Sounds like G major · 86% sure · or E minor", with a button to use it. */
function KeySuggestion({ song, onUse }: { song: Song; onUse: (key: string) => void }) {
  const suggestion = suggestedKey(song);
  if (!suggestion || suggestion.name === song.key) return null;
  const runnerUp = suggestKeys(chordSymbols(song))[1];
  return (
    <div className="key-suggestion" role="status">
      <span>
        Sounds like <strong>{suggestion.tonic} {suggestion.mode}</strong>
        <span className="key-sure"> · {Math.round(suggestion.confidence * 100)}% sure</span>
        {runnerUp && <span className="key-sure"> · or {runnerUp.tonic} {runnerUp.mode}</span>}
      </span>
      <button type="button" className="pill-btn" aria-label={`Use key ${suggestion.tonic} ${suggestion.mode}`} onClick={() => onUse(suggestion.name)}>
        Use
      </button>
    </div>
  );
}

/** One tap from a major key to its relative minor (G <-> Em) and back. */
function RelativeKey({ songKey, onSwitch }: { songKey: string | null; onSwitch: (key: string) => void }) {
  const rel = songKey ? relativeKey(songKey) : null;
  if (!rel) return null;
  return (
    <button type="button" className="chip-toggle" aria-label={`Relative key: ${describeKey(rel)}`} onClick={() => onSwitch(rel)}>
      ⇄ {describeKey(rel)}
    </button>
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

const CAPO_FRETS = Array.from({ length: MAX_CAPO + 1 }, (_, i) => i);

/** Capo fret (changes the pitch, not the shapes) and the Transpose & key sheet. */
function CapoRow({ song, update, onTranspose }: { song: Song; update: Update; onTranspose: () => void }) {
  return (
    <div className="capo-row">
      <label className="mini-field">
        <span className="section-label">Capo</span>
        <select aria-label="Capo" value={String(song.capo ?? 0)} onChange={(e) => update((s) => withCapo(s, Number(e.target.value)))}>
          {CAPO_FRETS.map((f) => (
            <option key={f} value={f}>
              {f === 0 ? 'None' : f}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="new-song-btn transpose-btn" onClick={onTranspose}>
        Transpose
      </button>
      {song.capo && song.key ? <span className="sounds-in">sounds in {describeKey(soundingKey(song))}</span> : null}
    </div>
  );
}

const LONG_PRESS_MS = 550;

const LONG_PRESS_SLOP_PX = 8;

/** Chords, rests, buttons and fields have their own press gestures (drag, tap, typing). */
const ownsGesture = (target: EventTarget) => target instanceof Element && !!target.closest('[data-slot-id], button, input, select, textarea');

/**
 * Press-and-hold on the bar itself (not on a chord, rest or control) opens the bar menu on
 * touch screens, where there is no right-click. Moving the finger cancels it.
 */
function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const origin = useRef({ x: 0, y: 0 });
  const cancel = () => clearTimeout(timer.current);
  return {
    onPointerDown: (e: PointerEvent) => {
      cancel();
      if (e.pointerType === 'mouse' || ownsGesture(e.target)) return;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(onLongPress, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      if (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > LONG_PRESS_SLOP_PX) cancel();
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
  drag: Drag;
  reorder: Reorder;
  selection: BarSelection;
  /** Show Roman numerals relative to this key (null = off). */
  numeralKey: string | null;
  /** Last hit of the previous bar, to know whether this bar's first chord is a change. */
  previous?: ChordHit;
  marks: BarMarks;
  /** Present while picking a loop section. */
  onPick?: () => void;
}

interface Reorder {
  count: number;
  move: (from: number, to: number) => void;
  begin: (e: PointerEvent, from: number) => void;
  view: BarDragView | null;
  /** Put keyboard focus on this bar's handle (after it was moved with the keyboard). */
  focus: boolean;
}

const MOVE_KEYS: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

/** Grip to drag the bar elsewhere; arrow keys move it one place. */
function Grip({ index, reorder }: { index: number; reorder: Reorder }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (reorder.focus) ref.current?.focus();
  }, [reorder.focus, index]);
  const onKeyDown = (e: KeyboardEvent) => {
    const to = index + (MOVE_KEYS[e.key] ?? 0);
    if (to === index || to < 0 || to >= reorder.count) return;
    e.preventDefault();
    reorder.move(index, to);
  };
  return (
    <button ref={ref} type="button" className="bar-grip" aria-label={`Move bar ${index + 1}`} onPointerDown={(e) => reorder.begin(e, index)} onKeyDown={onKeyDown}>
      ⠿
    </button>
  );
}

/** Where a dragged bar will land, drawn on the bar under the pointer. */
function DropLine({ index, view }: { index: number; view: BarDragView | null }) {
  if (!view || view.target !== index) return null;
  return <span className={`bar-drop-line ${view.side}`} data-testid="bar-drop-line" aria-hidden="true" />;
}

/** Whatever is being dragged, following the pointer. */
function DragLayer({ chord, bar }: { chord: DragView | null; bar: BarDragView | null }) {
  if (chord) return <DragGhost view={chord} />;
  return bar ? <BarGhost view={bar} /> : null;
}

function BarGhost({ view }: { view: BarDragView }) {
  return (
    <div className="drag-chip bar-chip" style={{ left: view.x, top: view.y }} aria-hidden="true">
      Bar {view.from + 1}
    </div>
  );
}

const barClass = (marks: BarMarks, moving: boolean) => `${markClasses(marks)}${moving ? ' is-moving' : ''}`;

/** Chips for a time-signature or tempo change starting at this bar. */
function ChangeMarkers({ bar }: { bar: Bar }) {
  return (
    <>
      {bar.timeSignature && <span className="bar-marker">{formatTimeSignature(bar.timeSignature)}</span>}
      {bar.tempo && <span className="bar-marker">♩ = {bar.tempo}</span>}
    </>
  );
}

const scrollBehavior = (): ScrollBehavior => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/** Keep the playing bar on screen (smooth unless the creator prefers reduced motion). */
function useFollow(current: boolean) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (current) ref.current?.scrollIntoView?.({ block: 'nearest', behavior: scrollBehavior() });
  }, [current]);
  return ref;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function PasteTile({ selection }: { selection: BarSelection }) {
  if (selection.clipSize === 0) return null;
  return (
    <li className="bar add-bar">
      <button type="button" className="add-chord" onClick={() => selection.paste(Infinity)}>
        <span className="add-plus" aria-hidden="true">⎘</span>
        <span>Paste {plural(selection.clipSize, 'bar')}</span>
      </button>
    </li>
  );
}

/** Actions for the selected bars. */
function SelectionBar({ selection }: { selection: BarSelection }) {
  const n = selection.ids.length;
  return (
    <div className="selection-bar" role="toolbar" aria-label="Selected bars">
      <span className="selection-count">{plural(n, 'bar')} selected</span>
      <button type="button" className="chip-toggle" disabled={n === 0} onClick={selection.copy}>
        Copy
      </button>
      <button type="button" className="chip-toggle" disabled={n === 0} onClick={selection.cut}>
        Cut
      </button>
      {selection.clipSize > 0 && (
        <button type="button" className="chip-toggle" onClick={() => selection.paste()}>
          Paste after
        </button>
      )}
      <button type="button" className="chip-toggle danger" disabled={n === 0} onClick={selection.remove}>
        Delete
      </button>
      <button type="button" className="chip-toggle" onClick={selection.done}>
        Done
      </button>
    </div>
  );
}

/** Section label, repeat signs and ending brackets on a bar. */
function StructureMarks({ bar }: { bar: Bar }) {
  return (
    <>
      {bar.section && <span className="bar-section">{bar.section}</span>}
      {bar.repeatStart && (
        <span className="repeat-mark start" aria-label="Repeat start">
          ‖:
        </span>
      )}
      <EndingMarks endings={bar.endings} />
      <RepeatEnd times={bar.repeatEnd} />
    </>
  );
}

const EndingMarks = ({ endings = [] }: { endings?: number[] }) =>
  endings.map((n) => (
    <span key={n} className="ending-mark" aria-label={`${['', '1st', '2nd', '3rd'][n]} ending`}>
      {n}.
    </span>
  ));

function RepeatEnd({ times }: { times?: number }) {
  if (!times) return null;
  return (
    <span className="repeat-mark end" aria-label={`Repeat end, play ${times} times`}>
      :‖{times > 2 ? ` ×${times}` : ''}
    </span>
  );
}

/** Shift-click selects a range, Ctrl/Cmd-click toggles one bar. */
const headClick = (selection: BarSelection, id: string) => (e: MouseEvent) => {
  if (e.shiftKey || e.metaKey || e.ctrlKey) selection.click(id, { shift: e.shiftKey, toggle: true });
};

function SelectBox({ selection, id, n }: { selection: BarSelection; id: string; n: number }) {
  if (!selection.mode) return null;
  return (
    <input
      type="checkbox"
      className="bar-select"
      aria-label={`Select bar ${n}`}
      checked={selection.ids.includes(id)}
      onChange={() => selection.click(id, { shift: false, toggle: true })}
    />
  );
}

function BarCard({ bar, index, update, actions, drag, reorder, selection, numeralKey, previous, marks, onPick }: BarProps) {
  const n = index + 1;
  const ref = useFollow(marks.current);
  const openMenu = () => actions.onBarMenu(index);
  const longPress = useLongPress(openMenu);
  return (
    <li
      ref={ref}
      className={`${barClass(marks, reorder.view?.from === index)}${selection.ids.includes(bar.id) ? ' is-selected' : ''}`}
      data-bar-index={index}
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
      <DropLine index={index} view={reorder.view} />
      <StructureMarks bar={bar} />
      <header className="bar-head" data-testid="bar-head" onClick={headClick(selection, bar.id)}>
        <SelectBox selection={selection} id={bar.id} n={n} />
        <Grip index={index} reorder={reorder} />
        <span className="bar-number" aria-hidden="true">{n}</span>
        <ChangeMarkers bar={bar} />
        <button type="button" className="bar-menu-btn" aria-label={`Bar ${n} options`} onClick={openMenu}>
          ⋯
        </button>
      </header>
      <Lane events={bar.events} previous={previous} actions={actions} drag={drag} numeralKey={numeralKey} />
      <input
        className="bar-lyrics"
        aria-label={`Lyrics for bar ${n}`}
        placeholder="lyrics…"
        value={bar.lyrics}
        onChange={(e) => update((s) => setLyrics(s, bar.id, e.target.value), `lyrics:${bar.id}`)}
      />
    </li>
  );
}

const previousHit = (events: SongEvent[], i: number, fromLastBar?: ChordHit) =>
  i === 0 ? fromLastBar : events.slice(0, i).filter((x): x is ChordHit => x.kind === 'chord').at(-1);

/** The bar's events side by side, each as wide as it is long. */
interface LaneProps {
  events: SongEvent[];
  previous?: ChordHit;
  actions: SongScreenActions;
  drag: Drag;
  numeralKey: string | null;
}

function Lane({ events, previous, actions, drag, numeralKey }: LaneProps) {
  /** A click that ends a drag is not a tap. */
  const tap = (fn: () => void) => () => {
    if (!drag.consumeClick()) fn();
  };
  return (
    <div className="bar-lane">
      {events.map((e, i) => {
        const dnd = dndFor(drag.view, e.id);
        if (e.kind === 'rest') return <RestSlot key={e.id} id={e.id} units={e.units} dnd={dnd} onTap={tap(() => actions.onRestTap(e.id))} />;
        const before = previousHit(events, i, previous);
        return (
          <HitSlot
            key={e.id}
            hit={e}
            isChange={!before || voicingKey(before) !== voicingKey(e)}
            barStart={events.findIndex((x) => x.kind === 'chord') === i}
            numeral={numeralKey ? romanNumeral(e.symbol, numeralKey) : null}
            dnd={dnd}
            onTap={tap(() => actions.onHitTap(e.id))}
            onPointerDown={(ev) => drag.onSlotPointerDown(ev, e.id, e.symbol)}
          />
        );
      })}
    </div>
  );
}

interface Dnd {
  dropTarget: boolean;
  dragging: boolean;
}

function dndFor(view: DragView | null, id: string): Dnd {
  if (!view) return { dropTarget: false, dragging: false };
  return { dropTarget: view.over === id && view.id !== id, dragging: view.id === id };
}

/** The chord name following the pointer while dragging. */
function DragGhost({ view }: { view: DragView }) {
  return (
    // left/top (not transform): the pop-in animation owns `transform`.
    <div className="drag-chip" style={{ left: view.x, top: view.y }} aria-hidden="true">
      {view.label}
    </div>
  );
}

const QUARTER = unitsOf(4);
const ARROWS = { 'strum-down': '↓', 'strum-up': '↑', 'arpeggio-down': '⇣', 'arpeggio-up': '⇡' } as const;

export const hitLabel = (h: ChordHit) => `${h.symbol}, ${lengthName(h.units)}, ${h.style} ${h.direction}${h.sustain === 'cut' ? ', cut off' : ''}`;

const slotClass = (hit: ChordHit, isChange: boolean, dnd: Dnd) =>
  ['lane-slot hit', isChange && 'is-change', hit.sustain === 'cut' && 'is-cut', dnd.dropTarget && 'is-drop-target', dnd.dragging && 'is-dragging'].filter(Boolean).join(' ');

interface HitSlotProps {
  hit: ChordHit;
  isChange: boolean;
  /** First chord of the bar: always named, so a bar never looks empty. */
  barStart: boolean;
  numeral: string | null;
  dnd: Dnd;
  onTap: () => void;
  onPointerDown: (e: PointerEvent) => void;
}

function HitSlot({ hit, isChange, barStart, numeral, dnd, onTap, onPointerDown }: HitSlotProps) {
  return (
    <button
      type="button"
      className={slotClass(hit, isChange, dnd)}
      data-slot-id={hit.id}
      onPointerDown={onPointerDown}
      data-testid="bar-hit"
      data-symbol={hit.symbol}
      aria-label={hitLabel(hit)}
      style={{ flexGrow: hit.units }}
      onClick={onTap}
    >
      <SlotName hit={hit} named={isChange || barStart} numeral={numeral} />
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

function SlotName({ hit, named, numeral }: { hit: ChordHit; named: boolean; numeral: string | null }) {
  if (!named) return null;
  return (
    <>
      <ChordSymbol symbol={hit.symbol} inline />
      <Numeral value={numeral} />
    </>
  );
}

function Numeral({ value }: { value: string | null | false }) {
  return value ? (
    <span className="numeral" data-testid="numeral">
      {value}
    </span>
  ) : null;
}

function RestSlot({ id, units, dnd, onTap }: { id: string; units: number; dnd: Dnd; onTap: () => void }) {
  return (
    <button type="button" className={`lane-slot rest${dnd.dropTarget ? ' is-drop-target' : ''}`} data-slot-id={id} data-testid="bar-rest" aria-label={`Rest, ${lengthName(units)} — add a chord here`} style={{ flexGrow: units }} onClick={onTap}>
      <span aria-hidden="true">＋</span>
      <span className="hit-len" aria-hidden="true">
        {shortLength(units)}
      </span>
    </button>
  );
}
