export interface HitSplatOptions {
  size?: number;
}

export function hitSplatSvg(opts: HitSplatOptions = {}): string {
  const size = opts.size ?? 96;
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 4;
  const inner = outer * 0.55;

  // Eight-spoke jagged starburst — alternating outer/inner radii around 16 points.
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 8;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="splat" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="#fff5b7"/>
        <stop offset="55%" stop-color="#f7c948"/>
        <stop offset="100%" stop-color="#d24a3a"/>
      </radialGradient>
    </defs>
    <polygon points="${pts.join(' ')}" fill="url(#splat)" stroke="#7a4d0c" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${cx}" cy="${cy}" r="${(outer * 0.30).toFixed(1)}" fill="#fff5b7" opacity="0.9"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
