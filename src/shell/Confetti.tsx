import { useMemo, type CSSProperties } from 'react';

// End-game celebration: a layer of falling, swaying confetti pieces. Each piece
// is an absolutely-positioned span with a CSS animation driving translate + rotate.
// Mounted only when the player beats the final level — see GameContainer.

const CONFETTI_COLORS = [
  '#f7c948', // gold (accent)
  '#e87a3a', // warm orange
  '#d24a3a', // red
  '#9efc9b', // mint
  '#5ca6e8', // blue
  '#ff8ac1', // pink
  '#b478e3', // purple
  '#fff5b7', // cream
];
const CONFETTI_COUNT = 90;

interface Piece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  swayDistance: number;
  rotateStart: number;
  rotateEnd: number;
  color: string;
  size: number;
  shape: 'rect' | 'circle';
}

function makePieces(): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    pieces.push({
      id: i,
      left: Math.random() * 100,
      // Negative delay so pieces start mid-animation — no blank period at mount.
      delay: -Math.random() * 5,
      duration: 4 + Math.random() * 3.5,
      // Mix of leftward and rightward sway so the burst feels chaotic.
      swayDistance: (Math.random() - 0.5) * 90,
      rotateStart: Math.random() * 360,
      rotateEnd: Math.random() * 360 + 720,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 7 + Math.floor(Math.random() * 8),
      shape: Math.random() < 0.6 ? 'rect' : 'circle',
    });
  }
  return pieces;
}

export function Confetti() {
  const pieces = useMemo(makePieces, []);
  return (
    <div className="confetti-layer" aria-hidden>
      {pieces.map((p) => {
        const style: CSSProperties & Record<string, string | number> = {
          left: `${p.left}%`,
          background: p.color,
          width: `${p.size}px`,
          height: `${p.shape === 'circle' ? p.size : p.size * 1.6}px`,
          borderRadius: p.shape === 'circle' ? '50%' : '2px',
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`,
          '--sway': `${p.swayDistance}px`,
          '--rot-start': `${p.rotateStart}deg`,
          '--rot-end': `${p.rotateEnd}deg`,
        };
        return <span key={p.id} className="confetti-piece" style={style} />;
      })}
    </div>
  );
}
