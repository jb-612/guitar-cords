import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import csp from './csp.cjs';

const directive = (name) => csp.CSP.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

describe('Content Security Policy', () => {
  it("allows the Google script Firebase's popup sign-in loads (regression: auth/internal-error)", () => {
    expect(directive('script-src')).toContain('https://apis.google.com');
    expect(directive('frame-src')).toContain('https://*.firebaseapp.com');
    expect(directive('connect-src')).toContain('https://*.googleapis.com');
  });

  it('is the one policy used by both the desktop app and the web build', () => {
    expect(fs.readFileSync('electron/main.cjs', 'utf8')).toMatch(/require\('\.\/csp\.cjs'\)/);
    expect(fs.readFileSync('vite.config.ts', 'utf8')).toMatch(/electron\/csp\.cjs/);
  });
});
