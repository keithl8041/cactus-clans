import { useState, useCallback } from 'react';

interface SharePanelProps {
  text: string;
  url?: string;
  title?: string;
}

export function SharePanel({ text, url: urlProp, title }: SharePanelProps) {
  const url = urlProp ?? window.location.origin;
  const [copied, setCopied] = useState(false);

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({ title: title ?? 'Cactus Clans', text, url });
    } catch {
      // cancelled or not supported — no-op
    }
  }, [text, url, title]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [url]);

  const fullMessage = `${text} ${url}`;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
      <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', width: '100%', textAlign: 'center' }}>
        Share with friends
      </div>
      {canNativeShare && (
        <button onClick={handleNativeShare} style={pill('#5a9e6a', '#fff')}>
          Share
        </button>
      )}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(fullMessage)}`}
        target="_blank"
        rel="noopener noreferrer"
        style={pill('#25d366', '#fff')}
      >
        WhatsApp
      </a>
      <a
        href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        style={pill('#1d9bf0', '#fff')}
      >
        Post on X
      </a>
      <button onClick={handleCopy} style={pill(copied ? '#3a7a2c' : '#f7c948', copied ? '#fff5b7' : '#1f2a14')}>
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  );
}

function pill(bg: string, color: string) {
  return {
    background: bg,
    color,
    border: 'none',
    borderRadius: 20,
    padding: '6px 16px',
    fontWeight: 700,
    fontSize: '0.82rem',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  } as const;
}
