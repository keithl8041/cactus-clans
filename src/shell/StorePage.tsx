import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSeoMeta } from './useSeoMeta';

// In-app store page. Instead of linking out to payhip.com, we embed the Payhip
// product container here via their embed-page.js loader. The script scans the
// DOM for `.payhip-embed-page[data-key]` and swaps in an iframe.
//
// Gotcha: Payhip binds its scanner (`PayhipEmbedPage.init`) to the window
// `load` event. On a hard refresh the script loads before `load` fires, so it
// runs — but on client-side SPA navigation `load` fired long ago, so the
// scanner never runs and the embed stays blank until a refresh. So once the
// Payhip global is available we call `init()` ourselves whenever the page has
// already finished loading.
const PAYHIP_KEY = 'SCwL1';
const PAYHIP_EMBED_SRC = 'https://payhip.com/embed-page.js?v=24u68985';

declare global {
  interface Window {
    PayhipEmbedPage?: { init: () => void };
  }
}

export function StorePage() {
  const navigate = useNavigate();

  useSeoMeta({
    title: 'Get the Printable Card Set',
    description:
      'Download the full Cactus Clans trading card collection — all eleven clans, ready to print and play at home. A perfect activity for kids and families.',
    path: '/shop',
  });

  useEffect(() => {
    const script = document.createElement('script');
    script.src = PAYHIP_EMBED_SRC;
    script.async = true;
    document.body.appendChild(script);

    // The loader injects further scripts async, so PayhipEmbedPage isn't
    // available immediately. Poll for it, then trigger the scan ourselves if
    // window `load` has already fired (Payhip's own listener won't).
    let cancelled = false;
    let elapsed = 0;
    const timer = window.setInterval(() => {
      elapsed += 100;
      const payhip = window.PayhipEmbedPage;
      if (payhip) {
        if (document.readyState === 'complete') payhip.init();
        window.clearInterval(timer);
      } else if (cancelled || elapsed >= 5000) {
        window.clearInterval(timer);
      }
    }, 100);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      script.remove();
    };
  }, []);

  return (
    <div className="screen store-page">
      <h1>Get the printable card set</h1>
      <p className="store-sub">The full Cactus Clans collection — ready to print and play at home.</p>

      {/* Payhip injects the product iframe into this container. */}
      <div className="payhip-embed-page" data-key={PAYHIP_KEY} />

      <div className="row">
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={() => navigate('/game')}>Play the game</button>
      </div>
    </div>
  );
}
