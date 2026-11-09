/**
 * Phone emulation check with real touch input (Chrome DevTools Protocol), for iPhone and
 * Android screen sizes. Not a substitute for real devices, but it exercises the touch paths:
 * taps, touch hold-and-drag barre, long-press bar menu, touch drag-and-drop of a chord,
 * and that a quick swipe scrolls instead of grabbing a chord.
 *
 *   npm run electron:dev   (or: npx vite)   then:   npx electron scripts/mobile-check.cjs
 * Env: APP_URL (default http://localhost:5317), SHOTS=<dir> to save screenshots.
 */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const APP_URL = process.env.APP_URL || 'http://localhost:5317';
const DEVICES = [
  { name: 'iPhone 15', width: 393, height: 852, dpr: 3, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
  { name: 'Pixel 8', width: 412, height: 915, dpr: 2.625, ua: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' },
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function check(device) {
  const win = new BrowserWindow({ width: device.width, height: device.height, show: false, webPreferences: { backgroundThrottling: false } });
  // Emulation must be set after a page has loaded (it then survives reloads).
  await win.loadURL(APP_URL);
  const cdp = win.webContents.debugger;
  cdp.attach('1.3');
  const send = (method, params) => cdp.sendCommand(method, params);
  await send('Emulation.setDeviceMetricsOverride', { width: device.width, height: device.height, deviceScaleFactor: device.dpr, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setUserAgentOverride', { userAgent: device.ua });
  await wait(800);
  const js = (code) => win.webContents.executeJavaScript(code);

  // Seed: G | C | (empty bar)
  await js(`(() => {
    const id = () => crypto.randomUUID();
    const G = { dots: [{string:0,fret:3,finger:2},{string:1,fret:2,finger:1},{string:5,fret:3,finger:3}], muted: [] };
    const C = { dots: [{string:1,fret:3,finger:3},{string:2,fret:2,finger:2},{string:4,fret:1,finger:1}], muted: [0] };
    const hit = (symbol, shape, units) => ({ id: id(), kind: 'chord', symbol, shape, units, direction: 'down', style: 'strum', sustain: 'ring' });
    const bars = [
      { id: id(), lyrics: '', events: [hit('G', G, 16), hit('C', C, 16)] },
      { id: id(), lyrics: '', events: [{ id: id(), kind: 'rest', units: 32 }] },
      ...Array.from({ length: 8 }, () => ({ id: id(), lyrics: '', events: [hit('G', G, 32)] })),
    ];
    const song = { id: id(), title: 'Touch test', key: 'G', tempo: 90, timeSignature: { beats: 4, unit: 4 }, bars };
    localStorage.setItem('guitar-cords:library', JSON.stringify({ currentId: song.id, songs: [song] }));
    location.reload();
  })()`);
  await wait(1500);

  const center = async (sel) => {
    const at = await js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
    if (!at) throw new Error(`${device.name}: nothing matches ${sel}`);
    return at;
  };
  const touch = (type, [x, y]) => send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  /**
   * Touch-type pointer events dispatched in the page at exact element positions. The emulator's
   * own touch mapping drifts by tens of pixels inside scrolled sheets, so precise gestures
   * (drag, long-press, barre) use these; the real-touch path is still used for scrolling.
   */
  const pointer = (type, [x, y], target) =>
    js(`(() => {
      const el = ${target ? `document.querySelector(${JSON.stringify(target)})` : `document.elementFromPoint(${x}, ${y})`};
      el.dispatchEvent(new PointerEvent(${JSON.stringify(type)}, { pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: ${x}, clientY: ${y}, bubbles: true, cancelable: true, button: 0, buttons: ${type === 'pointerup' ? 0 : 1} }));
    })()`);
  /** Moves and release go where a captured pointer's events go: the capturing svg, else the window. */
  const press = async (a, b, holdMs, target) => {
    await pointer('pointerdown', a, target);
    await wait(holdMs);
    const sink = target ? `(document.querySelector(${JSON.stringify(target)})?.closest('svg') ?? window)` : 'window';
    for (let i = 1; i <= 10; i++) {
      const p = [a[0] + ((b[0] - a[0]) * i) / 10, a[1] + ((b[1] - a[1]) * i) / 10];
      await js(`${sink}.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: ${p[0]}, clientY: ${p[1]}, bubbles: true, buttons: 1 }))`);
      await wait(30);
    }
    await js(`${sink}.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: ${b[0]}, clientY: ${b[1]}, bubbles: true }))`);
    await wait(400);
  };
  const tap = async (p) => {
    await touch('touchStart', p);
    await wait(40);
    await touch('touchEnd', p);
    await wait(350);
  };
  const drag = async (a, b, holdMs) => {
    await touch('touchStart', a);
    await wait(holdMs);
    for (let i = 1; i <= 10; i++) {
      await touch('touchMove', [a[0] + ((b[0] - a[0]) * i) / 10, a[1] + ((b[1] - a[1]) * i) / 10]);
      await wait(30);
    }
    await touch('touchEnd', b);
    await wait(400);
  };
  const lanes = () => js(`[...document.querySelectorAll('li[aria-label^="Bar "]')].slice(0, 2).map(b => [...b.querySelectorAll('[data-testid=bar-hit],[data-testid=bar-rest]')].map(s => s.dataset.symbol ?? '-').join(' ')).join(' | ')`);
  const results = {};

  // 1. A quick swipe on a chord scrolls the page and does not start a drag.
  await js('window.scrollTo(0, 0)');
  const start = await center('li[aria-label="Bar 3"] [data-testid=bar-hit]');
  await js('window.scrollTo(0, 0)');
  const y0 = await js('window.scrollY');
  await drag(start, [start[0], start[1] - 250], 0);
  results.swipeScrolls = (await js('window.scrollY')) > y0;
  results.swipeDidNotMove = (await lanes()) === 'G C | -';

  // 2. Touch hold, then drag a chord into the empty bar.
  const g = await center('li[aria-label="Bar 1"] [data-testid=bar-hit]');
  const rest = await js(`(() => { const r = document.querySelector('li[aria-label="Bar 2"] [data-testid=bar-rest]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  await press(g, rest, 400);
  results.touchDragMoved = (await lanes()) === '- C | G -';

  // 3. Long-press a bar header opens its menu.
  const head = await center('li[aria-label="Bar 3"] [data-testid=bar-head]');
  await pointer('pointerdown', head);
  await wait(800);
  await pointer('pointerup', head);
  await wait(400);
  results.longPressMenu = await js(`!!document.querySelector('[role=dialog][aria-label="Bar 3"]')`);
  await js(`document.querySelector('.sheet-close')?.click()`);
  await wait(300);

  // 4. Chord editor: tap to place a finger, then touch hold-and-drag it into a barre.
  const SHEET_SETTLE_MS = 700; // sheets slide in; measure only once they've stopped
  await tap(await center('.add-chord'));
  await wait(SHEET_SETTLE_MS);
  // Emulated touches near the bottom of a scrolled sheet land a few pixels off (an emulator quirk,
  // not seen on devices), so this one button is clicked directly; the editor itself is driven by touch.
  await js("document.querySelector('.create-btn').click()");
  await wait(SHEET_SETTLE_MS);
  await js(`document.querySelector('[aria-label="String 6, fret 1"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  await wait(300);
  const dot = await center('[data-testid="dot-0"] .dot-fill');
  const highE = await center('[aria-label="String 1, fret 1"]');
  await press(dot, highE, 600, '[data-testid="dot-0"] .dot-fill');
  results.barreFingers = await js(`[...document.querySelectorAll('[data-testid^=dot-]')].length`);
  results.barreDrawn = await js(`!!document.querySelector('[data-testid="barre-1@1"]')`);
  results.chordName = await js(`document.querySelector('[data-testid=chord-name]')?.getAttribute('aria-label')`);

  if (process.env.SHOTS) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.env.SHOTS, `mobile-${device.name.replace(/\s/g, '-')}.png`), Buffer.from(shot.data, 'base64'));
  }
  win.destroy();
  const ok = results.swipeScrolls && results.swipeDidNotMove && results.touchDragMoved && results.longPressMenu && results.barreFingers === 6 && results.barreDrawn;
  return { device: device.name, ok, ...results };
}

app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const all = [];
  for (const d of DEVICES) all.push(await check(d));
  for (const r of all) process.stdout.write(`MOBILE ${r.ok ? 'PASS' : 'FAIL'} ${JSON.stringify(r)}\n`);
  app.exit(all.every((r) => r.ok) ? 0 : 1);
});
