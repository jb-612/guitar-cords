import type { SongView } from './usePlayer';

const VIEWS: { view: SongView; label: string }[] = [
  { view: 'chords', label: 'Chords' },
  { view: 'tab', label: 'Tab' },
  { view: 'score', label: 'Score' },
];

/** Segmented control for the song view; the indicator slides between options. */
export function ViewSwitch({ value, onChange }: { value: SongView; onChange: (v: SongView) => void }) {
  const index = VIEWS.findIndex((v) => v.view === value);
  return (
    <div className="view-switch" role="radiogroup" aria-label="View">
      <span className="view-indicator" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden="true" />
      {VIEWS.map(({ view, label }) => (
        <button key={view} type="button" role="radio" aria-checked={value === view} className="view-option" onClick={() => onChange(view)}>
          {label}
        </button>
      ))}
    </div>
  );
}
