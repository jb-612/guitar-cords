import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { STRING_COUNT, VISIBLE_FRETS, type ChordShape, type FretDot, type Finger } from '../music/chordShape';
import { BOARD_HEIGHT, BOARD_WIDTH, G, VIEW_HEIGHT, VIEW_WIDTH, cellCenterY, fretY, stringX } from './diagramGeometry';
import type { EditorAction, EditorState } from './editorReducer';
import { useDotDrag, type DragState } from './useDotDrag';
import './ChordDiagram.css';

const STRINGS = Array.from({ length: STRING_COUNT }, (_, s) => s);
const ROWS = Array.from({ length: VISIBLE_FRETS }, (_, i) => i + 1);
/** Low (wound) strings are drawn thicker, like the real thing. */
const STRING_WIDTH = [2.6, 2.2, 1.8, 1.4, 1.1, 0.9];
const SINGLE_INLAYS = new Set([3, 5, 7, 9, 15, 17]);
const DOUBLE_INLAY = 12;

/** Guitarists number strings 6 (low E) to 1 (high E). */
export const stringNumber = (s: number) => STRING_COUNT - s;
export const fingerLabel = (f: Finger) => (f === 0 ? 'T' : String(f));

const KEY_ACTIONS: Record<string, EditorAction> = {
  ArrowLeft: { type: 'nudge', dString: -1, dFret: 0 },
  ArrowRight: { type: 'nudge', dString: 1, dFret: 0 },
  ArrowUp: { type: 'nudge', dString: 0, dFret: -1 },
  ArrowDown: { type: 'nudge', dString: 0, dFret: 1 },
  Delete: { type: 'remove' },
  Backspace: { type: 'remove' },
  Escape: { type: 'select', string: null },
  '1': { type: 'finger', finger: 1 },
  '2': { type: 'finger', finger: 2 },
  '3': { type: 'finger', finger: 3 },
  '4': { type: 'finger', finger: 4 },
  t: { type: 'finger', finger: 0 },
  'Shift+ArrowLeft': { type: 'extend', dir: -1 },
  'Shift+ArrowRight': { type: 'extend', dir: 1 },
};

interface Props {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
}

export function ChordDiagram({ state, dispatch }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { drag, onDotPointerDown, onPointerMove, onPointerUp, consumeDragClick } = useDotDrag({ svgRef, shape: state.shape, startFret: state.startFret, dispatch });
  const tap = (action: EditorAction) => {
    if (!consumeDragClick()) dispatch(action);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const action = KEY_ACTIONS[e.shiftKey ? `Shift+${e.key}` : e.key];
    if (!action) return;
    e.preventDefault();
    dispatch(action);
  };

  return (
    <svg
      ref={svgRef}
      className={`diagram${drag ? ` is-${drag.mode}` : ''}${state.refusal ? ' is-refused' : ''}`}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      role="application"
      aria-label="Chord diagram. Tap a cell to place a finger; arrow keys move the selected finger; Shift plus left or right arrow stretches it into a barre."
      tabIndex={0}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Board startFret={state.startFret} />
      <NutRow shape={state.shape} onToggle={(string) => tap({ type: 'nut', string })} />
      <Cells startFret={state.startFret} onTap={(string, fret) => tap({ type: 'cell', string, fret })} />
      <Barres shape={state.shape} startFret={state.startFret} />
      <Dots
        state={state}
        drag={drag}
        onTap={(d) => tap({ type: 'cell', string: d.string, fret: d.fret })}
        onPointerDown={onDotPointerDown}
      />
      {drag?.mode === 'move' && <DragGhost drag={drag} shape={state.shape} />}
    </svg>
  );
}

function Board({ startFret }: { startFret: number }) {
  const atNut = startFret === 1;
  return (
    <g className="board" aria-hidden="true">
      <rect className="board-bg" x={G.left - 14} y={G.top} width={BOARD_WIDTH + 28} height={BOARD_HEIGHT} rx={4} />
      {ROWS.map((row) => (
        <Inlay key={`inlay-${startFret + row - 1}`} fret={startFret + row - 1} row={row} />
      ))}
      {[0, ...ROWS].map((row) => (
        <line key={row} className="fret" x1={G.left} x2={G.left + BOARD_WIDTH} y1={fretY(row)} y2={fretY(row)} />
      ))}
      {atNut && <rect className="nut" x={G.left - 1.5} y={G.top - 6} width={BOARD_WIDTH + 3} height={7} rx={1.5} />}
      {STRINGS.map((s) => (
        <line key={s} className={s < 3 ? 'string wound' : 'string'} strokeWidth={STRING_WIDTH[s]} x1={stringX(s)} x2={stringX(s)} y1={G.top} y2={G.top + BOARD_HEIGHT} />
      ))}
      {!atNut && (
        <text key={startFret} className="fret-label" x={G.left - 20} y={cellCenterY(1)} textAnchor="end" dominantBaseline="central">
          {startFret}fr
        </text>
      )}
    </g>
  );
}

function Inlay({ fret, row }: { fret: number; row: number }) {
  const cx = G.left + BOARD_WIDTH / 2;
  if (fret === DOUBLE_INLAY) {
    return (
      <g className="inlay">
        <circle cx={stringX(1) + G.stringGap / 2} cy={cellCenterY(row)} r={4} />
        <circle cx={stringX(3) + G.stringGap / 2} cy={cellCenterY(row)} r={4} />
      </g>
    );
  }
  return SINGLE_INLAYS.has(fret) ? <circle className="inlay" cx={cx} cy={cellCenterY(row)} r={4} /> : null;
}

function NutRow({ shape, onToggle }: { shape: ChordShape; onToggle: (s: number) => void }) {
  return (
    <g className="nut-row">
      {STRINGS.map((s) => {
        const muted = shape.muted.includes(s);
        const fretted = shape.dots.some((d) => d.string === s);
        return (
          <g
            key={s}
            role="button"
            aria-label={`${muted ? 'Unmute' : 'Mute'} string ${stringNumber(s)}`}
            className={`nut-toggle${muted ? ' is-muted' : ''}${fretted ? ' is-fretted' : ''}`}
            onClick={() => onToggle(s)}
          >
            <rect x={stringX(s) - G.stringGap / 2} y={G.top - G.nutZone} width={G.stringGap} height={G.nutZone - 6} fill="transparent" />
            <NutMark x={stringX(s)} y={G.top - 22} muted={muted} />
          </g>
        );
      })}
    </g>
  );
}

function NutMark({ x, y, muted }: { x: number; y: number; muted: boolean }) {
  if (muted) {
    return (
      <g key="x" className="nut-mark mute">
        <line x1={x - 6} y1={y - 6} x2={x + 6} y2={y + 6} />
        <line x1={x + 6} y1={y - 6} x2={x - 6} y2={y + 6} />
      </g>
    );
  }
  return <circle key="o" className="nut-mark open" cx={x} cy={y} r={7} />;
}

function Cells({ startFret, onTap }: { startFret: number; onTap: (s: number, f: number) => void }) {
  return (
    <g className="cells">
      {ROWS.flatMap((row) =>
        STRINGS.map((s) => {
          const fret = startFret + row - 1;
          return (
            <g key={`${s}-${row}`} role="button" tabIndex={-1} aria-label={`String ${stringNumber(s)}, fret ${fret}`} className="cell" onClick={() => onTap(s, fret)}>
              <rect x={stringX(s) - G.stringGap / 2} y={fretY(row - 1)} width={G.stringGap} height={G.fretGap} fill="transparent" />
              <circle className="cell-ghost" cx={stringX(s)} cy={cellCenterY(row)} r={G.dotRadius} />
            </g>
          );
        }),
      )}
    </g>
  );
}

const inWindow = (fret: number, startFret: number) => fret >= startFret && fret < startFret + VISIBLE_FRETS;

/** Same finger on two or more strings at one fret = a barre bar behind the dots. */
function Barres({ shape, startFret }: { shape: ChordShape; startFret: number }) {
  const groups = new Map<string, FretDot[]>();
  for (const d of shape.dots) {
    const key = `${d.finger}@${d.fret}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const barres = [...groups.values()].filter((g) => g.length > 1 && inWindow(g[0]!.fret, startFret));
  return (
    <g className="barres" aria-hidden="true">
      {barres.map((g) => {
        const strings = g.map((d) => d.string);
        const x1 = stringX(Math.min(...strings));
        const x2 = stringX(Math.max(...strings));
        const y = cellCenterY(g[0]!.fret - startFret + 1);
        return <rect key={`${g[0]!.finger}@${g[0]!.fret}`} data-testid={`barre-${g[0]!.finger}@${g[0]!.fret}`} className="barre" x={x1 - G.dotRadius} y={y - G.dotRadius * 0.62} width={x2 - x1 + G.dotRadius * 2} height={G.dotRadius * 1.24} rx={G.dotRadius * 0.62} />;
      })}
    </g>
  );
}

interface DotsProps {
  state: EditorState;
  drag: DragState | null;
  onTap: (d: FretDot) => void;
  onPointerDown: (e: PointerEvent, dot: FretDot) => void;
}

const dragging = (drag: DragState | null, string: number, mode: DragState['mode']) => drag?.mode === mode && drag.from === string;

/** The selected finger: a whole barre is selected when any of its pieces is. */
const isSelectedFinger = (d: FretDot, selected: FretDot | undefined) => !!selected && d.finger === selected.finger && d.fret === selected.fret;

function dotClasses(d: FretDot, selected: FretDot | undefined, drag: DragState | null): string[] {
  const flags: [string, boolean][] = [
    ['is-thumb', d.finger === 0],
    ['is-selected', isSelectedFinger(d, selected)],
    ['is-lifted', dragging(drag, d.string, 'move')],
    ['is-pressing', dragging(drag, d.string, 'pressing')],
    ['is-stretching', dragging(drag, d.string, 'stretch')],
  ];
  return ['dot', ...flags.filter(([, on]) => on).map(([name]) => name)];
}

function Dots({ state, drag, onTap, onPointerDown }: DotsProps) {
  const visible = state.shape.dots.filter((d) => inWindow(d.fret, state.startFret));
  const selectedDot = state.shape.dots.find((d) => d.string === state.selected);
  return (
    <g className="dots">
      {visible.map((d) => {
        const classes = dotClasses(d, selectedDot, drag);
        return (
          <g
            key={d.string}
            data-testid={`dot-${d.string}`}
            className={classes.join(' ')}
            style={{ transform: `translate(${stringX(d.string)}px, ${cellCenterY(d.fret - state.startFret + 1)}px)` }}
            onClick={() => onTap(d)}
            onPointerDown={(e) => onPointerDown(e, d)}
          >
            <g className="dot-body">
              <circle className="dot-ring" r={G.dotRadius + 5} />
              <circle className="dot-fill" r={G.dotRadius} />
              <text className="dot-label" dominantBaseline="central" textAnchor="middle">
                {labelled(d, visible) ? fingerLabel(d.finger) : ''}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** A barre shows its finger number once, on its lowest string, like a printed chart. */
const labelled = (d: FretDot, dots: FretDot[]) =>
  !dots.some((o) => o.finger === d.finger && o.fret === d.fret && o.string < d.string);

function DragGhost({ drag, shape }: { drag: DragState; shape: ChordShape }) {
  const dot = shape.dots.find((d) => d.string === drag.from);
  if (!dot) return null;
  return (
    <g className={`dot drag-ghost${dot.finger === 0 ? ' is-thumb' : ''}`} style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }} aria-hidden="true">
      <circle className="dot-fill" r={G.dotRadius + 2} />
      <text className="dot-label" dominantBaseline="central" textAnchor="middle">
        {fingerLabel(dot.finger)}
      </text>
    </g>
  );
}
