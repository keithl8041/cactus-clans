export interface DuneWallOptions {
  size?: number;
}

export function duneWallSvg(opts: DuneWallOptions = {}): string {
  const size = opts.size ?? 48;
  // Tileable dune-ridge: darker base + a curved highlight that wraps left to
  // right cleanly. Small "shadow" stripe at the bottom.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="dw" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7a4d0c"/>
        <stop offset="100%" stop-color="#3f3326"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${size}" height="${size}" fill="url(#dw)"/>
    <path d="M 0 ${(size * 0.30).toFixed(1)} Q ${(size * 0.5).toFixed(1)} ${(size * 0.18).toFixed(1)} ${size} ${(size * 0.30).toFixed(1)}"
      stroke="#a26b1c" stroke-width="2" fill="none" opacity="0.55"/>
    <rect x="0" y="${(size * 0.80).toFixed(1)}" width="${size}" height="${(size * 0.20).toFixed(1)}" fill="#1a1a1a" opacity="0.35"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
