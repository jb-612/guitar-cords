/**
 * Content Security Policy for the app: sent as a header by the desktop app's local server
 * and written as a meta tag into the web build (GitHub Pages can't send headers).
 * Firebase needs: apis.google.com (script for popup sign-in), *.firebaseapp.com (sign-in
 * iframe), *.googleapis.com and *.firebaseio.com (auth and Firestore requests).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://apis.google.com",
  'frame-src https://*.firebaseapp.com https://accounts.google.com',
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

module.exports = { CSP };
