import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import server from './server.cjs';

const { distFile, startServer } = server;

describe('distFile', () => {
  // Built with path so the expectations hold on Windows (backslashes, drive letters) too.
  const dist = path.resolve('/app/dist');
  it('maps paths into dist, with index.html for the root', () => {
    expect(distFile(dist, '/')).toBe(path.join(dist, 'index.html'));
    expect(distFile(dist, '/assets/app.js')).toBe(path.join(dist, 'assets', 'app.js'));
    expect(distFile(dist, '/soundfont/sonivox%20sf2.sf2')).toBe(path.join(dist, 'soundfont', 'sonivox sf2.sf2'));
  });
  it('never leaves dist', () => {
    expect(distFile(dist, '/../secret.txt')).toBeNull();
    expect(distFile(dist, '/%2e%2e/secret.txt')).toBeNull();
    expect(distFile(dist, '/..%2fsecret.txt')).toBeNull();
    expect(distFile(dist, '/assets/%00x')).toBeNull();
  });
});

describe('local app server', () => {
  let stop = () => {};
  afterEach(() => stop());

  it('serves dist on localhost with the CSP, the right types, and 404s outside it', async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-dist-'));
    fs.writeFileSync(path.join(dist, 'index.html'), '<h1>hi</h1>');
    fs.mkdirSync(path.join(dist, 'assets'));
    fs.writeFileSync(path.join(dist, 'assets', 'a.js'), 'x=1');
    const s = await startServer({ dist, csp: "default-src 'self'", ports: [0] });
    stop = s.close;
    expect(s.url).toMatch(/^http:\/\/localhost:\d+$/);

    const index = await fetch(`${s.url}/`);
    expect(await index.text()).toBe('<h1>hi</h1>');
    expect(index.headers.get('content-security-policy')).toBe("default-src 'self'");
    expect(index.headers.get('content-type')).toMatch(/text\/html/);
    expect((await fetch(`${s.url}/assets/a.js`)).headers.get('content-type')).toMatch(/javascript/);
    expect((await fetch(`${s.url}/missing.js`)).status).toBe(404);
    expect((await fetch(`${s.url}/%2e%2e/%2e%2e/etc/hosts`)).status).toBe(404);
  });

  it('uses the next port when the preferred one is taken', async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-dist-'));
    const first = await startServer({ dist, csp: '', ports: [0] });
    const port = Number(new URL(first.url).port);
    const second = await startServer({ dist, csp: '', ports: [port, 0] });
    stop = () => { first.close(); second.close(); };
    expect(second.url).not.toBe(first.url);
  });
});
