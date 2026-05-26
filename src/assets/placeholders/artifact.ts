export interface ArtifactOptions {
  size?: number;
}

export function artifactSvg(opts: ArtifactOptions = {}): string {
  const size = opts.size ?? 36;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  // Gold amulet / coin with a small gem center. Reuses the star's gradient palette.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="art" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#fff5b7"/>
        <stop offset="55%" stop-color="#f7c948"/>
        <stop offset="100%" stop-color="#7a4d0c"/>
      </radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="url(#art)" stroke="#7a4d0c" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${(r * 0.55).toFixed(1)}" fill="none" stroke="#7a4d0c" stroke-width="1.5" opacity="0.6"/>
    <polygon points="${cx},${(cy - r * 0.3).toFixed(1)} ${(cx + r * 0.25).toFixed(1)},${cy} ${cx},${(cy + r * 0.3).toFixed(1)} ${(cx - r * 0.25).toFixed(1)},${cy}"
      fill="#d24a3a" stroke="#5a2d1f" stroke-width="1.5"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
