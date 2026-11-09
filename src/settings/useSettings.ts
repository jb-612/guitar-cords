/** App preferences on this device: theme, left-handed diagrams, first-run tour. */
import { createContext, useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
/** Size of the bars on the song canvas: compact hides the mini diagrams. */
export type ChordView = 'compact' | 'normal' | 'large';

export interface Settings {
  theme: Theme;
  leftHanded: boolean;
  chordView: ChordView;
}

const KEY = 'guitar-cords:settings';
export const TOUR_KEY = 'guitar-cords:tour-seen';
const DEFAULTS: Settings = { theme: 'system', leftHanded: false, chordView: 'normal' };

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: preference lasts for this session.
  }
};

function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(read(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

/** Set a data attribute on <html>, or remove it for the default value. */
function setRootData(name: 'theme' | 'chordView', value: string, fallback: string) {
  if (value === fallback) delete document.documentElement.dataset[name];
  else document.documentElement.dataset[name] = value;
}

/** Light/dark follows the system unless chosen; tokens.css reads data-theme. SongScreen.css reads data-chord-view. */
function applyLook(s: Settings) {
  setRootData('theme', s.theme, 'system');
  setRootData('chordView', s.chordView, 'normal');
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);
  const [tourOpen, setTourOpen] = useState(() => read(TOUR_KEY) === null);
  useEffect(() => {
    write(KEY, JSON.stringify(settings));
    applyLook(settings);
  }, [settings]);
  return {
    settings,
    update: (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })),
    tourOpen,
    openTour: () => setTourOpen(true),
    closeTour: () => {
      write(TOUR_KEY, '1');
      setTourOpen(false);
    },
  };
}

export type SettingsApi = ReturnType<typeof useSettings>;

/** Left-handed creators see chord diagrams mirrored (low E on the right). */
export const LeftHandedContext = createContext(false);
