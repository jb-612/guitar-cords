import '@testing-library/jest-dom/vitest';

/**
 * Tests start past the first-run walkthrough: its "seen" flag survives localStorage.clear().
 * Tests about the walkthrough remove the flag themselves.
 */
export const TOUR_KEY = 'guitar-cords:tour-seen';
// Node-environment tests (alphaTab parsing) have no Web Storage on older Node versions.
if (typeof Storage !== 'undefined') {
  const clear = Storage.prototype.clear;
  Storage.prototype.clear = function (this: Storage) {
    clear.call(this);
    if (this === globalThis.localStorage) this.setItem(TOUR_KEY, '1');
  };
  beforeEach(() => globalThis.localStorage?.setItem(TOUR_KEY, '1'));
}
