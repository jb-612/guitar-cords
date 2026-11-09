/**
 * Offline support for the web app: registers the service worker built by vite-plugin-pwa.
 * Only for the production web app over http(s): not in development, tests, or the desktop
 * app (Electron ships its own files; a cache there would keep serving old versions).
 */
interface Environment {
  prod: boolean;
  protocol: string;
  hasServiceWorker: boolean;
  userAgent: string;
}

export const shouldRegisterServiceWorker = (env: Environment) =>
  env.prod && env.protocol.startsWith('http') && env.hasServiceWorker && !/\bElectron\//.test(env.userAgent);

export async function registerServiceWorker() {
  const env = { prod: import.meta.env.PROD, protocol: location.protocol, hasServiceWorker: 'serviceWorker' in navigator, userAgent: navigator.userAgent };
  if (!shouldRegisterServiceWorker(env)) return;
  const { registerSW } = await import('virtual:pwa-register');
  registerSW({ immediate: true });
}
