/**
 * Packaged-app smoke test (GC_SELFTEST=1): checks that the app loads from its local server,
 * that alphaTab's SoundFont, fonts and worker load (playback advances through bars,
 * the tab view renders), and that no CSP or load errors were reported. Exits 0/1.
 */
const { app } = require('electron');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(win) {
  const problems = [];
  win.webContents.on('console-message', (event) => {
    const msg = String(event.message ?? '');
    if (/Content Security Policy|Refused to|Failed to load|net::ERR|Uncaught/i.test(msg)) problems.push(msg.slice(0, 300));
  });
  await new Promise((r) => win.webContents.once('did-finish-load', r));
  const js = (code) => win.webContents.executeJavaScript(code);
  await js(`(() => {
    const id = () => crypto.randomUUID();
    const G = { dots: [{string:0,fret:3,finger:2},{string:1,fret:2,finger:1},{string:5,fret:3,finger:3}], muted: [] };
    const C = { dots: [{string:1,fret:3,finger:3},{string:2,fret:2,finger:2},{string:4,fret:1,finger:1}], muted: [0] };
    const bar = (symbol, shape) => ({ id: id(), lyrics: '', events: [{ id: id(), kind: 'chord', symbol, shape, units: 32, direction: 'down', style: 'strum', sustain: 'ring' }] });
    const song = { id: id(), title: 'Self test', key: 'G', tempo: 240, timeSignature: { beats: 4, unit: 4 }, bars: [G, C, G, C, G, C, G, C].map((shape, i) => bar(i % 2 ? 'C' : 'G', shape)) };
    localStorage.setItem('guitar-cords:library', JSON.stringify({ currentId: song.id, songs: [song] }));
    location.reload();
  })()`);
  await new Promise((r) => win.webContents.once('did-finish-load', r));
  await wait(1000);
  await js(`document.querySelector('[aria-label="Play"]').click()`);
  const bars = new Set();
  for (let i = 0; i < 40 && bars.size < 2; i++) {
    await wait(250);
    bars.add(await js(`document.querySelector('[aria-current="true"]')?.getAttribute('aria-label') ?? ''`));
    bars.delete('');
  }
  await js(`[...document.querySelectorAll('[role=radio]')].find((b) => b.textContent === 'Tab').click()`);
  await wait(3000);
  const svgs = await js(`document.querySelectorAll('[data-testid=score-host] svg').length`);
  const origin = await js('location.origin');
  const result = { origin, barsPlayed: [...bars], tabSvgs: svgs, problems };
  const ok = bars.size >= 2 && svgs > 0 && problems.length === 0;
  process.stdout.write(`SELFTEST ${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(result)}\n`);
  app.exit(ok ? 0 : 1);
}

module.exports = { run };
