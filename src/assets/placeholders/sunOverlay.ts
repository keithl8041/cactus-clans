export interface SunOverlayOptions {
  size?: number;
}

export function sunOverlaySvg(opts: SunOverlayOptions = {}): string {
  const size = opts.size ?? 256;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="sun" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fff5b7" stop-opacity="0.85"/>
        <stop offset="60%" stop-color="#f7a23a" stop-opacity="0.50"/>
        <stop offset="100%" stop-color="#f7a23a" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#sun)"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
