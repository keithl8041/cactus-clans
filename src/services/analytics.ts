const GA_MEASUREMENT_ID = 'G-5K2BCNPSYB';

/**
 * Hostnames that should never report to GA: local dev boxes and LAN IPs used
 * for phone testing. Anything else (www / beta / staging cactusclans.co.uk,
 * etc.) is treated as a real deploy and measured.
 */
function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local') ||
    // private LAN ranges (e.g. 192.168.x.x / 10.x.x.x phone-testing addresses)
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/**
 * Loads Google Analytics (gtag.js) on every real (non-localhost) domain.
 *
 * Guarded twice on purpose:
 * - `import.meta.env.PROD` keeps GA out of `vite dev`.
 * - the hostname check keeps it off local dev boxes and LAN IPs used for phone
 *   testing, while allowing all deployed domains (www, beta, etc.).
 */
export function initAnalytics(): void {
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined') return;
  if (isLocalHost(window.location.hostname)) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  // gtag must push the `arguments` object verbatim — gtag.js only processes
  // dataLayer entries that are the actual Arguments object, not a plain array.
  // So this can't be an arrow function or use rest params (which would push a
  // real Array and be silently ignored).
  function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
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
  try {
    window.gtag('event', name, params);
  } catch (err) {
    console.warn('analytics event dropped', err);
  }
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}
