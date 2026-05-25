import { useEffect } from 'react';
import type { LevelInstructions } from '../levels/types';

interface Props {
  levelNumber: number;
  title: string;
  passThreshold: number;
  instructions: LevelInstructions;
  onStart: () => void;
  onCancel: () => void;
}

export function InstructionsModal({ levelNumber, title, passThreshold, instructions, onStart, onCancel }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart, onCancel]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        zIndex: 40,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: 'var(--bg-elev)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          padding: '1.5rem 1.75rem',
          maxWidth: '32rem',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Level {levelNumber}
          </div>
          <h2 style={{ margin: '0.25rem 0 0', color: 'var(--accent)', fontSize: '1.5rem' }}>{title}</h2>
        </div>

        <div>
          <div style={{ color: 'var(--text-dim)', fontWeight: 600, marginBottom: '0.25rem' }}>Objective</div>
          <div>{instructions.objective}</div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Pass threshold: <strong style={{ color: 'var(--accent)' }}>{passThreshold}</strong>
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--text-dim)', fontWeight: 600, marginBottom: '0.25rem' }}>Controls</div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {instructions.controls.map((c) => (
              <li key={c.label}>
                <strong>{c.label}:</strong> {c.value}
              </li>
            ))}
          </ul>
        </div>

        {instructions.tips && instructions.tips.length > 0 && (
          <div>
            <div style={{ color: 'var(--text-dim)', fontWeight: 600, marginBottom: '0.25rem' }}>Tips</div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {instructions.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="row" style={{ marginTop: '0.5rem' }}>
          <button className="primary" onClick={onStart} autoFocus>
            Start (Enter)
          </button>
          <button onClick={onCancel}>Back to map</button>
        </div>
      </div>
    </div>
  );
}
