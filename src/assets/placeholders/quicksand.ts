export interface QuicksandOptions {
  size?: number;
}

export function quicksandSvg(opts: QuicksandOptions = {}): string {
  const size = opts.size ?? 44;
  const cx = size / 2;
  const cy = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="qs" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#8a4624"/>
        <stop offset="60%" stop-color="#c9974a"/>
        <stop offset="100%" stop-color="#d9a86a"/>
      </radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${(size / 2 - 1).toFixed(1)}" fill="url(#qs)" opacity="0.95"/>
    <ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(size * 0.35).toFixed(1)}" ry="${(size * 0.10).toFixed(1)}" fill="#3f3326" opacity="0.35"/>
    <ellipse cx="${cx.toFixed(1)}" cy="${(cy - size * 0.05).toFixed(1)}" rx="${(size * 0.20).toFixed(1)}" ry="${(size * 0.06).toFixed(1)}" fill="#3f3326" opacity="0.55"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
