import { useEffect, useRef } from 'react';
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
  const modalRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    modal.scrollTop = 0;
    const frame = window.requestAnimationFrame(() => {
      modal.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [levelNumber, title, instructions]);

  return (
    <div className="instructions-backdrop">
      <div className="instructions-modal" ref={modalRef}>
        <div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Level {levelNumber}
          </div>
          <h2 style={{ margin: '0.25rem 0 0', color: 'var(--accent)', fontSize: '1.5rem' }}>{title}</h2>
        </div>

        <div className="instructions-body">
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
        </div>

        <div className="row" style={{ marginTop: '0.25rem' }}>
          <button className="primary" onClick={onStart} autoFocus>
            Start (Enter)
          </button>
          <button onClick={onCancel}>Back to map</button>
        </div>
      </div>
    </div>
  );
}
