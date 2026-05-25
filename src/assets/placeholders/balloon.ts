// Procedural SVG placeholder for the balloon used in level 1.
// Returns a data URL Phaser can load as a texture.

export interface BalloonOptions {
  color?: string;
  size?: number;
}

export function balloonSvg(opts: BalloonOptions = {}): string {
  const color = opts.color ?? '#e94f4f';
  const size = opts.size ?? 128;
  const w = size;
  const h = Math.round(size * 1.25);
  const cx = w / 2;
  const cy = w / 2 + 4;
  const rx = w / 2 - 6;
  const ry = w / 2 - 2;
  const knotY = cy + ry + 4;
  const stringEndY = h - 4;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <radialGradient id="g" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
        <stop offset="40%" stop-color="${color}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="1"/>
      </radialGradient>
    </defs>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#g)" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>
    <polygon points="${cx - 6},${knotY} ${cx + 6},${knotY} ${cx},${knotY + 8}" fill="${color}" opacity="0.8"/>
    <path d="M ${cx} ${knotY + 8} Q ${cx - 8} ${(knotY + stringEndY) / 2} ${cx} ${stringEndY}" stroke="#222" stroke-width="1.5" fill="none"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
