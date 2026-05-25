export interface StarOptions {
  size?: number;
}

export function starSvg(opts: StarOptions = {}): string {
  const size = opts.size ?? 64;
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 4;
  const inner = outer * 0.45;

  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="sg" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stop-color="#fff5b7"/>
        <stop offset="55%" stop-color="#f7c948"/>
        <stop offset="100%" stop-color="#c9881f"/>
      </radialGradient>
    </defs>
    <polygon points="${pts.join(' ')}" fill="url(#sg)" stroke="#7a4d0c" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
