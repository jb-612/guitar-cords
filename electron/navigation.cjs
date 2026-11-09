/**
 * Where the desktop app's windows may go.
 * - The app window stays on the app (app:// or the dev server); other links open in the system browser.
 * - Firebase sign-in opens a popup inside the app, which must be free to move between the
 *   Firebase auth handler and Google's sign-in pages until it hands the result back.
 */
const POPUP_HOSTS = [/\.firebaseapp\.com$/];
const SIGN_IN_HOSTS = [/\.firebaseapp\.com$/, /^accounts\.google\.com$/, /^accounts\.youtube\.com$/];

const httpsHostIn = (url, hosts) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && hosts.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
};

function createPolicy({ scheme, devUrl }) {
  const isAppUrl = (url) => url.startsWith(`${scheme}://`) || Boolean(devUrl && url.startsWith(devUrl));
  return {
    isAppUrl,
    canNavigate: (url, isSignInPopup) => isAppUrl(url) || (isSignInPopup && httpsHostIn(url, SIGN_IN_HOSTS)),
    canOpenPopup: (url) => httpsHostIn(url, POPUP_HOSTS),
  };
}

/** Electron's user agent without the app and Electron tokens, so Google treats the popup as Chrome. */
const chromeUserAgent = (ua) => ua.replace(/ \S+\/\d[\d.]*(?= Chrome)/, '').replace(/ Electron\/\S+/, '');

module.exports = { createPolicy, chromeUserAgent };
