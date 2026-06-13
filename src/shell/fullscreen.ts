/**
 * Tiny wrapper around the Fullscreen API. Used to hide mobile browser chrome
 * (notably the iOS Safari URL bar) when the player taps Start on a level.
 * Calls degrade silently if the browser declines — older iOS Safari, in
 * particular, only honours fullscreen for <video> elements.
 *
 * Must be invoked synchronously inside a user-gesture handler (click/keydown)
 * or the browser will reject the request.
 */

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

/**
 * On touch devices in landscape, request fullscreen on the next user gesture.
 * The Fullscreen API rejects non-gesture calls, so we listen for the next
 * pointerdown/keydown after landscape is detected and request it then. The
 * listener cleans itself up after firing or when orientation changes back.
 *
 * Call once during app startup. Returns a cleanup function.
 */
export function autoFullscreenInLandscape(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!isTouchDevice()) return () => {};

  const landscape = window.matchMedia('(orientation: landscape)');
  let gestureCleanup: (() => void) | null = null;

  function armGestureListener() {
    if (gestureCleanup) return;
    const handler = () => {
      gestureCleanup?.();
      gestureCleanup = null;
      if (landscape.matches && !isFullscreenActive()) {
        void enterFullscreen();
      }
    };
    window.addEventListener('pointerdown', handler, { once: true, capture: true });
    window.addEventListener('keydown', handler, { once: true, capture: true });
    gestureCleanup = () => {
      window.removeEventListener('pointerdown', handler, true);
      window.removeEventListener('keydown', handler, true);
    };
  }

  function onOrientationChange() {
    if (landscape.matches) {
      if (!isFullscreenActive()) armGestureListener();
    } else {
      gestureCleanup?.();
      gestureCleanup = null;
    }
  }

  if (landscape.matches) armGestureListener();
  landscape.addEventListener('change', onOrientationChange);

  return () => {
    landscape.removeEventListener('change', onOrientationChange);
    gestureCleanup?.();
    gestureCleanup = null;
  };
}

export async function enterFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  const el = document.documentElement as FullscreenElement;
  const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
  if (!req) return;
  try {
    await req();
  } catch {
    // Browser declined (e.g., iOS Safari < 16.4). No-op.
  }
}

export async function exitFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  const doc = document as FullscreenDocument;
  const active = doc.fullscreenElement ?? doc.webkitFullscreenElement;
  if (!active) return;
  const exit = doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc);
  if (!exit) return;
  try {
    await exit();
  } catch {
    // ignore
  }
}
