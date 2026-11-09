import { describe, expect, it } from 'vitest';
import navigation from './navigation.cjs';

const { createPolicy, chromeUserAgent } = navigation;

const policy = createPolicy({ appUrl: 'http://localhost:47317' });

describe('desktop navigation policy', () => {
  it('keeps the app window on the app', () => {
    expect(policy.canNavigate('http://localhost:47317/', false)).toBe(true);
    expect(policy.canNavigate('http://localhost:47317/index.html', false)).toBe(true);
    expect(policy.canNavigate('http://localhost:47318/', false)).toBe(false);
    expect(policy.canNavigate('http://localhost:473170/', false)).toBe(false);
    expect(policy.canNavigate('https://accounts.google.com/signin', false)).toBe(false);
    expect(policy.canNavigate('https://example.com/', false)).toBe(false);
  });

  it('lets the sign-in popup move between Firebase and Google sign-in pages (regression: it was sent to the system browser)', () => {
    expect(policy.canNavigate('https://guitar-cords-jb.firebaseapp.com/__/auth/handler', true)).toBe(true);
    expect(policy.canNavigate('https://accounts.google.com/o/oauth2/auth?x=1', true)).toBe(true);
    expect(policy.canNavigate('https://accounts.youtube.com/accounts/SetSID', true)).toBe(true);
    expect(policy.canNavigate('https://example.com/', true)).toBe(false);
    expect(policy.canNavigate('http://accounts.google.com/', true)).toBe(false);
  });

  it('opens only Firebase sign-in popups inside the app', () => {
    expect(policy.canOpenPopup('https://guitar-cords-jb.firebaseapp.com/__/auth/handler?apiKey=x')).toBe(true);
    expect(policy.canOpenPopup('https://example.com/')).toBe(false);
  });

  it('presents the sign-in popup as plain Chrome (Google refuses embedded app browsers)', () => {
    const ua = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) guitar-cords/0.1.0 Chrome/140.0.0.0 Electron/45.0.0 Safari/537.36';
    expect(chromeUserAgent(ua)).toBe('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36');
  });
});
