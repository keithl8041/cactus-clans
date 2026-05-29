/**
 * Tiny helper for "send the user somewhere specific *after* they finish
 * signing in." Used by the versus easter-egg URL: an unauthed visitor
 * lands on /versus/<code>, gets bounced to the splash to pick a player,
 * and the splash/nickname/clan-select flow then resumes their journey
 * onto the lobby URL instead of /journey.
 *
 * Stored in sessionStorage (not localStorage) so it dies with the tab.
 */

const KEY = 'cc.postAuthReturn.v1';

/** Same-origin relative paths only — never lets a redirect escape the SPA. */
function isSafePath(path: string): boolean {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}

export function setReturnTo(path: string): void {
  if (!isSafePath(path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // ignore — Safari private mode etc.
  }
}

/** Read and clear in one call. Returns null if missing or unsafe. */
export function consumeReturnTo(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    if (!path) return null;
    sessionStorage.removeItem(KEY);
    return isSafePath(path) ? path : null;
  } catch {
    return null;
  }
}
