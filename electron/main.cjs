/**
 * Electron main process.
 * - Development: loads the Vite dev server (VITE_DEV_SERVER_URL).
 * - Packaged: serves dist/ over a private app:// protocol. A real origin (not file://)
 *   lets alphaTab load its worker, audio worklet, fonts and SoundFont.
 * Security: renderer sandboxed with no Node access, strict Content Security Policy,
 * navigation locked to the app, external links open in the system browser.
 * GC_SELFTEST=1 runs a packaged-app smoke test (loads a song, plays it) and exits.
 */
const { app, BrowserWindow, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createPolicy, chromeUserAgent } = require('./navigation.cjs');

const SCHEME = 'app';
const DIST = path.join(__dirname, '..', 'dist');
const devUrl = process.env.VITE_DEV_SERVER_URL;


const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com",
  'frame-src https://*.firebaseapp.com',
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

/** app://guitar-cords/<path> -> dist/<path>, never outside dist. */
function serveDist() {
  protocol.handle(SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)));
    if (!file.startsWith(DIST)) return new Response('Not found', { status: 404 });
    const response = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CSP);
    return new Response(response.body, { status: response.status, headers });
  });
}

const policy = createPolicy({ scheme: SCHEME, devUrl });
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

function createWindow() {
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
  void win.loadURL(devUrl ?? `${SCHEME}://guitar-cords/index.html`);
  if (process.env.GC_SELFTEST) void require('./selftest.cjs').run(win);
  return win;
}

app.whenReady().then(() => {
  if (!devUrl) serveDist();
  createWindow();
});
app.on('web-contents-created', (_e, contents) => lockDown(contents));
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || process.env.GC_SELFTEST) app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
