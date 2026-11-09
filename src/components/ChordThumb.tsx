/**
 * Small, static chord diagram for libraries and song bars. Decorative:
 * the surrounding button carries the chord name for screen readers.
 */
import { STRING_COUNT, viewStartFret, type ChordShape } from '../music/chordShape';
import './ChordThumb.css';

const FRETS = 4;
const GAP_X = 10;
const GAP_Y = 12;
const LEFT = 12;
const TOP = 14;
const WIDTH = LEFT * 2 + GAP_X * (STRING_COUNT - 1);
const HEIGHT = TOP + GAP_Y * FRETS + 6;

const x = (s: number) => LEFT + s * GAP_X;

export function ChordThumb({ shape }: { shape: ChordShape }) {
  const start = viewStartFret(shape);
  const strings = Array.from({ length: STRING_COUNT }, (_, s) => s);
  return (
    <svg className="chord-thumb" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
      {Array.from({ length: FRETS + 1 }, (_, r) => (
        <line key={r} className={r === 0 && start === 1 ? 'ct-nut' : 'ct-fret'} x1={x(0)} x2={x(5)} y1={TOP + r * GAP_Y} y2={TOP + r * GAP_Y} />
      ))}
      {strings.map((s) => (
        <line key={s} className="ct-string" x1={x(s)} x2={x(s)} y1={TOP} y2={TOP + FRETS * GAP_Y} />
      ))}
      {start > 1 && (
        <text className="ct-label" x={2} y={TOP + GAP_Y / 2} dominantBaseline="central">
          {start}
        </text>
      )}
      <Markers shape={shape} />
      {shape.dots
        .filter((d) => d.fret - start < FRETS)
        .map((d) => (
          <circle key={d.string} className={d.finger === 0 ? 'ct-dot is-thumb' : 'ct-dot'} cx={x(d.string)} cy={TOP + (d.fret - start + 0.5) * GAP_Y} r={3.6} />
        ))}
    </svg>
  );
}

function Markers({ shape }: { shape: ChordShape }) {
  return (
    <g>
      {Array.from({ length: STRING_COUNT }, (_, s) => s)
        .filter((s) => !shape.dots.some((d) => d.string === s))
        .map((s) => (shape.muted.includes(s) ? <text key={s} className="ct-mute" x={x(s)} y={TOP - 6} textAnchor="middle">×</text> : <circle key={s} className="ct-open" cx={x(s)} cy={TOP - 7} r={2.6} />))}
    </g>
  );
}
