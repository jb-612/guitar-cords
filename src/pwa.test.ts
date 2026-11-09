import { shouldRegisterServiceWorker } from './pwa';

const web = { prod: true, protocol: 'https:', hasServiceWorker: true, userAgent: 'Mozilla/5.0 Chrome/140 Safari/537.36' };

describe('service worker registration', () => {
  it('registers for the production web app', () => {
    expect(shouldRegisterServiceWorker(web)).toBe(true);
  });
  it('skips development, non-http pages and browsers without service workers', () => {
    expect(shouldRegisterServiceWorker({ ...web, prod: false })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...web, protocol: 'file:' })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...web, hasServiceWorker: false })).toBe(false);
  });
  it('skips the desktop app, which ships its files itself (a cache would hide app updates)', () => {
    expect(shouldRegisterServiceWorker({ ...web, protocol: 'http:', userAgent: 'Mozilla/5.0 Chrome/140 Electron/45.0.0 Safari/537.36' })).toBe(false);
  });
});
