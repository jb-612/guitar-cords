/**
 * Electron main process.
 * - Development: loads the Vite dev server (VITE_DEV_SERVER_URL).
 * - Packaged: serves dist/ from a local server at http://localhost:47317 (server.cjs).
 *   A web origin lets alphaTab load its worker, audio worklet, fonts and SoundFont,
 *   and lets Firebase's Google sign-in run (localhost is an allowed sign-in domain).
 * Security: renderer sandboxed with no Node access, strict Content Security Policy,
 * navigation locked to the app, external links open in the system browser.
 * GC_SELFTEST=1 runs a packaged-app smoke test (loads a song, plays it) and exits;
 * it uses a throwaway data folder so it never touches the creator's songs.
 */
const { app, BrowserWindow, shell } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPolicy, chromeUserAgent } = require('./navigation.cjs');
const { startServer } = require('./server.cjs');
const { CSP } = require('./csp.cjs');

/** Fixed so saved songs (stored per origin) are found again next launch; later ones only if it's taken. */
const APP_PORTS = [47317, 47318, 47319, 0];
const DIST = path.join(__dirname, '..', 'dist');
const devUrl = process.env.VITE_DEV_SERVER_URL;



if (process.env.GC_SELFTEST) app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'guitar-cords-selftest-')));

let policy = createPolicy({ appUrl: devUrl ?? 'http://localhost' });
/** Firebase sign-in popups: the only other pages that open inside the app. */
const signInPopups = new WeakSet();

function lockDown(contents) {
  contents.on('will-navigate', (event, url) => {
    if (policy.canNavigate(url, signInPopups.has(contents))) return;
    event.preventDefault();
    void shell.openExternal(url);
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (policy.canOpenPopup(url)) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('did-create-window', (child) => {
    signInPopups.add(child.webContents);
    child.webContents.setUserAgent(chromeUserAgent(child.webContents.getUserAgent()));
  });
}

function createWindow(appUrl) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    backgroundColor: '#f6f1e7',
    title: 'Guitar Cords',
    show: !process.env.GC_SELFTEST,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: !process.env.GC_SELFTEST,
      autoplayPolicy: process.env.GC_SELFTEST ? 'no-user-gesture-required' : 'user-gesture-required',
    },
  });
  lockDown(win.webContents);
  void win.loadURL(appUrl);
  if (process.env.GC_SELFTEST) void require('./selftest.cjs').run(win);
  return win;
}

let appUrl = devUrl;
app.whenReady().then(async () => {
  appUrl ??= (await startServer({ dist: DIST, csp: CSP, ports: APP_PORTS })).url;
  policy = createPolicy({ appUrl });
  createWindow(appUrl);
});
app.on('web-contents-created', (_e, contents) => lockDown(contents));
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || process.env.GC_SELFTEST) app.quit();
});
app.on('activate', () => {
  if (appUrl && BrowserWindow.getAllWindows().length === 0) createWindow(appUrl);
});
