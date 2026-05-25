interface Props {
  active: boolean;
}

export function RotateOverlay({ active }: Props) {
  if (!active) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.92)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        padding: '2rem',
        textAlign: 'center',
        zIndex: 50,
      }}
    >
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
        <g
          fill="none"
          stroke="var(--accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="20" y="14" width="40" height="64" rx="6" transform="rotate(-25 40 46)" />
          <path d="M64 30 a26 26 0 0 1 16 30" />
          <polyline points="78,52 80,60 88,58" />
        </g>
      </svg>
      <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--accent)' }}>Rotate your device</h2>
      <p style={{ margin: 0, color: 'var(--text-dim)', maxWidth: '24rem' }}>
        This level needs landscape mode. Turn your phone sideways to play.
      </p>
    </div>
  );
}
