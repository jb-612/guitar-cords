/**
 * Serves the built app (dist/) to the packaged desktop app at http://localhost:<port>.
 * A normal http origin is needed because Firebase sign-in only works on web origins
 * (localhost is allowed by default), and alphaTab's worker, audio worklet and SoundFont
 * don't load from file://. It listens on the loopback interface only, serves only files
 * inside dist/, and sends the Content Security Policy with every response.
 * The port is fixed so the app's saved data (kept per origin) stays put between launches.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
  '.sf2': 'application/octet-stream',
  '.sf3': 'application/octet-stream',
};

/** The file in dist for a URL path, or null if it would fall outside dist or can't be decoded. */
function distFile(dist, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const file = path.normalize(path.join(dist, decoded));
  return file.startsWith(dist + path.sep) ? file : null;
}

function handler(dist, csp) {
  return (req, res) => {
    const file = distFile(dist, new URL(req.url ?? '/', 'http://localhost').pathname);
    fs.stat(file ?? '', (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Content-Length': stat.size, 'Content-Security-Policy': csp, 'Cache-Control': 'no-cache' });
      fs.createReadStream(file).pipe(res);
    });
  };
}

const listen = (server, port) =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });

/** Start serving on the first free port of `ports` (0 = any). Resolves to { url, close }. */
async function startServer({ dist, csp, ports }) {
  const server = http.createServer(handler(path.resolve(dist), csp));
  for (const port of ports) {
    try {
      const bound = await listen(server, port);
      return { url: `http://localhost:${bound}`, close: () => server.close() };
    } catch {
      // Port taken: try the next one.
    }
  }
  throw new Error('No free port for the app server');
}

module.exports = { distFile, startServer };
