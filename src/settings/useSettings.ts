/** App preferences on this device: theme, left-handed diagrams, first-run tour. */
import { createContext, useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  theme: Theme;
  leftHanded: boolean;
}

const KEY = 'guitar-cords:settings';
export const TOUR_KEY = 'guitar-cords:tour-seen';
const DEFAULTS: Settings = { theme: 'system', leftHanded: false };

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

/** Light/dark follows the system unless chosen; tokens.css reads data-theme. */
function applyTheme(theme: Theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);
  const [tourOpen, setTourOpen] = useState(() => read(TOUR_KEY) === null);
  useEffect(() => {
    write(KEY, JSON.stringify(settings));
    applyTheme(settings.theme);
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
