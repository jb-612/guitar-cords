/** Settings: theme, left-handed diagrams, and the tips walkthrough. */
import { SheetHeader } from '../components/Sheet';
import type { ChordView, SettingsApi, Theme } from './useSettings';
import '../song/HitSheet.css';
import './SettingsSheet.css';

const THEMES: [Theme, string][] = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

const CHORD_VIEWS: [ChordView, string][] = [
  ['compact', 'Compact'],
  ['normal', 'Normal'],
  ['large', 'Large'],
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
        <div className="seg" role="radiogroup" aria-label="Chord view size">
          {CHORD_VIEWS.map(([size, label]) => (
            <button key={size} type="button" role="radio" aria-checked={s.chordView === size} onClick={() => update({ chordView: size })}>
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
      <About />
    </div>
  );
}

const COPYRIGHT_YEAR = 2026;
const LICENSE_URL = 'https://github.com/jb-612/guitar-cords/blob/main/LICENSE';

function About() {
  return (
    <section className="hit-section settings-about">
      <span className="section-label">About</span>
      <p className="settings-credit">
        Guitar Cords · © {COPYRIGHT_YEAR} Jishu Technologies Ltd.
        <br />
        Free and open source under the{' '}
        <a href={LICENSE_URL} target="_blank" rel="noreferrer">
          MIT License
        </a>
        .
      </p>
    </section>
  );
}
