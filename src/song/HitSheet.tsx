/**
 * Options for one chord hit: length (note value, dotted, or fill to bar end),
 * strum direction, strum or arpeggio, let ring or cut off; duplicate, edit shape, delete.
 * Changes apply immediately so the creator sees the bar re-flow behind the sheet.
 */
import { ChordThumb } from '../components/ChordThumb';
import { SheetHeader } from '../components/Sheet';
import { NOTE_VALUES, unitsOf, type NoteValue } from './rhythm';
import { canTriplet } from '../player/alphaTex';
import type { ChordHit, HitStyle } from './song';
import './HitSheet.css';

const VALUE_LABELS: Record<NoteValue, [string, string]> = {
  1: ['Whole', '1'],
  2: ['Half', '½'],
  4: ['Quarter', '¼'],
  8: ['Eighth', '⅛'],
  16: ['Sixteenth', '1/16'],
  32: ['Thirty-second', '1/32'],
};

interface Props {
  hit: ChordHit;
  /** Units from the hit's start to the end of its bar: the most it can be. */
  room: number;
  onLength: (units: number) => void;
  onStyle: (style: HitStyle) => void;
  onRepeat: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function HitSheet({ hit, room, onLength, onStyle, onRepeat, onEdit, onDelete, onClose }: Props) {
  const dotted = NOTE_VALUES.some((v) => v < 32 && unitsOf(v, true) === hit.units);
  return (
    <div className="hit-sheet">
      <SheetHeader title={`${hit.symbol} chord`} onClose={onClose} />
      <div className="hit-preview">
        <ChordThumb shape={hit.shape} />
      </div>
      <section className="hit-section">
        <div className="hit-section-head">
          <span className="section-label">Length</span>
          <button type="button" className="chip-toggle" aria-pressed={dotted} onClick={() => onLength(toggleDot(hit.units))}>
            Dotted
          </button>
          <button type="button" className="chip-toggle" onClick={() => onLength(room)}>
            Fill bar
          </button>
        </div>
        <div className="seg" role="radiogroup" aria-label="Length">
          {NOTE_VALUES.map((v) => {
            const units = unitsOf(v, dotted && v < 32);
            const [label, short] = VALUE_LABELS[v];
            return (
              <button key={v} type="button" role="radio" aria-label={label} aria-checked={hit.units === units} disabled={units > room} onClick={() => onLength(units)}>
                {short}
              </button>
            );
          })}
        </div>
      </section>
      <Choice label="Direction" value={hit.direction} options={[['down', 'Down', '↓'], ['up', 'Up', '↑']]} onChange={(direction) => onStyle({ direction })} />
      <Choice label="Style" value={hit.style} options={[['strum', 'Strum', '≡'], ['arpeggio', 'Arpeggio', '≀']]} onChange={(style) => onStyle({ style })} />
      <Choice label="Ending" value={hit.sustain} options={[['ring', 'Let ring', '◠'], ['cut', 'Cut off', '⌐']]} onChange={(sustain) => onStyle({ sustain })} />
      <Choice
        label="Technique"
        value={hit.technique ?? 'normal'}
        options={[['normal', 'Normal', '♪'], ['palm', 'Palm mute', 'PM'], ['muted', 'Muted (chuck)', '✕']]}
        onChange={(technique) => onStyle({ technique })}
      />
      <Extras hit={hit} onStyle={onStyle} />
      <div className="hit-actions">
        <button type="button" className="btn primary" onClick={onRepeat}>
          Duplicate
        </button>
        <button type="button" className="btn ghost" onClick={onEdit}>
          Edit shape
        </button>
        <button type="button" className="btn ghost danger" onClick={onDelete}>
          Delete chord
        </button>
      </div>
    </div>
  );
}

/** Dotted ↔ plain for the same note value (e.g. quarter 8 ↔ dotted quarter 12). */
function toggleDot(units: number): number {
  const plain = NOTE_VALUES.find((v) => v < 32 && unitsOf(v, true) === units);
  if (plain) return unitsOf(plain);
  return NOTE_VALUES.some((v) => v < 32 && unitsOf(v) === units) ? units * 1.5 : units;
}

interface ChoiceProps<T extends string> {
  label: string;
  value: T;
  options: [T, string, string][];
  onChange: (v: T) => void;
}

function Choice<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  return (
    <section className="hit-section">
      <span className="section-label">{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map(([v, text, icon]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
            <span aria-hidden="true">{icon}</span> {text}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Accent, triplet strum and a lyric syllable for this chord. */
function Extras({ hit, onStyle }: { hit: ChordHit; onStyle: (s: HitStyle) => void }) {
  return (
    <section className="hit-section">
      <div className="chip-row">
        <label className="mixer-check-inline">
          <input type="checkbox" checked={!!hit.accent} onChange={(e) => onStyle({ accent: e.target.checked })} />
          Accent
        </label>
        <label className="mixer-check-inline">
          <input type="checkbox" checked={!!hit.triplet} disabled={!canTriplet(hit.units)} onChange={(e) => onStyle({ triplet: e.target.checked })} />
          Triplet (3 strums in this time)
        </label>
      </div>
      <label className="hit-section-inline">
        <span className="section-label">Lyric for this chord</span>
        <input
          className="text-input"
          aria-label="Lyric for this chord"
          placeholder="e.g. a syllable sung on this strum"
          value={hit.lyric ?? ''}
          onChange={(e) => onStyle({ lyric: e.target.value })}
        />
      </label>
    </section>
  );
}
