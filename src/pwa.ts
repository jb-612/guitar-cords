/**
 * Offline support for the web app: registers the service worker built by vite-plugin-pwa.
 * Only over http(s) in production — not in development, tests, or Electron's app:// protocol.
 */
export async function registerServiceWorker() {
  if (!import.meta.env.PROD || !location.protocol.startsWith('http') || !('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  registerSW({ immediate: true });
}
