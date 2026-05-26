export interface DuneFloorOptions {
  size?: number;
}

export function duneFloorSvg(opts: DuneFloorOptions = {}): string {
  const size = opts.size ?? 96;
  // Tileable sand: warm tan base + a sprinkling of small grain dots that wrap
  // safely (kept away from the edges so left/right and top/bottom abut cleanly).
  const grains: string[] = [];
  for (let i = 0; i < 18; i++) {
    const x = 6 + ((i * 53) % (size - 12));
    const y = 9 + ((i * 31) % (size - 18));
    const r = 0.8 + ((i * 7) % 3) * 0.3;
    const opacity = 0.25 + ((i * 13) % 5) * 0.07;
    grains.push(`<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="#5a3a1f" opacity="${opacity.toFixed(2)}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect x="0" y="0" width="${size}" height="${size}" fill="#d9a86a"/>
    ${grains.join('\n    ')}
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
