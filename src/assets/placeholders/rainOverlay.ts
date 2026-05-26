export interface RainOverlayOptions {
  size?: number;
}

export function rainOverlaySvg(opts: RainOverlayOptions = {}): string {
  const size = opts.size ?? 256;
  // Diagonal blue streaks across a transparent square.
  const lines: string[] = [];
  const step = size / 10;
  for (let i = -1; i <= 11; i++) {
    const x = i * step;
    lines.push(
      `<line x1="${x.toFixed(1)}" y1="0" x2="${(x + size * 0.25).toFixed(1)}" y2="${size}" stroke="#5b8fc7" stroke-width="2" opacity="0.55"/>`,
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect x="0" y="0" width="${size}" height="${size}" fill="#274a78" opacity="0.18"/>
    ${lines.join('\n    ')}
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
