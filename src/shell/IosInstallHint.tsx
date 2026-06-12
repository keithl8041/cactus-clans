import { useEffect, useState } from 'react';

// One-off hint shown to iOS Safari users who haven't installed the PWA.
// Adding to Home Screen is the only way to get a real fullscreen game on iOS
// (the Fullscreen API is video-only there). Dismissal is persisted so we don't
// nag repeat visitors.

const DEFAULT_DISMISS_KEY = 'cactus-clans:hide-ios-install-hint';

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS 13+ identifies as Mac but exposes touch points.
  const iPadOnDesktopUA = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOnDesktopUA;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS-specific property; also fall back to the standard display-mode query.
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function IosInstallHint({ storageKey = DEFAULT_DISMISS_KEY }: { storageKey?: string } = {}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIos() || isStandalone()) return;
    if (localStorage.getItem(storageKey) === '1') return;
    setVisible(true);
  }, [storageKey]);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // private mode etc — fine, the banner just comes back next visit
    }
    setVisible(false);
  }

  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        border: '2px solid var(--panel-dim)',
        borderRadius: 'var(--radius)',
        padding: '0.75rem 1rem',
        maxWidth: 420,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        textAlign: 'left',
        fontSize: '0.95rem',
      }}
    >
      <div style={{ flex: 1, color: 'var(--text)' }}>
        <strong style={{ color: 'var(--accent)' }}>Better fullscreen:</strong>{' '}
        tap <span aria-label="Share">⬆️</span> Share → Add to Home Screen.
      </div>
      <button onClick={dismiss} aria-label="Dismiss" style={{ padding: '0.4rem 0.7rem', fontSize: '0.9rem' }}>
        Got it
      </button>
    </div>
  );
}
