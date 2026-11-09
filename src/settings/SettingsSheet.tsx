/** Settings: theme, left-handed diagrams, and the tips walkthrough. */
import { SheetHeader } from '../components/Sheet';
import type { SettingsApi, Theme } from './useSettings';
import '../song/HitSheet.css';

const THEMES: [Theme, string][] = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

export function SettingsSheet({ settings, onClose }: { settings: SettingsApi; onClose: () => void }) {
  const { settings: s, update } = settings;
  return (
    <div className="settings">
      <SheetHeader title="Settings" onClose={onClose} />
      <section className="hit-section">
        <span className="section-label">Appearance</span>
        <div className="seg" role="radiogroup" aria-label="Theme">
          {THEMES.map(([theme, label]) => (
            <button key={theme} type="button" role="radio" aria-checked={s.theme === theme} onClick={() => update({ theme })}>
              {label}
            </button>
          ))}
        </div>
      </section>
      <section className="hit-section">
        <span className="section-label">Playing</span>
        <label className="mixer-check-inline">
          <input type="checkbox" checked={s.leftHanded} onChange={(e) => update({ leftHanded: e.target.checked })} />
          Left-handed (mirror chord diagrams: low E on the right)
        </label>
      </section>
      <section className="hit-section">
        <span className="section-label">Help</span>
        <div className="chip-row">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              onClose();
              settings.openTour();
            }}
          >
            Show the tips again
          </button>
        </div>
      </section>
    </div>
  );
}
