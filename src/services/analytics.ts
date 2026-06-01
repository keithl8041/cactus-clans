const GA_MEASUREMENT_ID = 'G-5K2BCNPSYB';
const GA_HOST = 'www.cactusclans.co.uk';

/**
 * Loads Google Analytics (gtag.js), but only for the real production site.
 *
 * Guarded twice on purpose:
 * - `import.meta.env.PROD` keeps GA out of `vite dev`.
 * - the hostname check keeps it off preview/staging deploys and any other
 *   domain the bundle might be served from, so only real traffic is measured.
 */
export function initAnalytics(): void {
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined') return;
  if (window.location.hostname !== GA_HOST) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  // gtag must push `arguments` verbatim, so it can't be an arrow function.
  function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID);
}

/**
 * Send a GA4 event. No-op unless `initAnalytics` actually loaded gtag (i.e. the
 * real production site) — on dev/preview `window.gtag` is undefined, so this
 * silently does nothing and callers don't need their own env guards.
 */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}
