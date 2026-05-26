// Procedural SVG placeholder for the level-2 dartboard. Returns a data URL
// Phaser can load as a texture. Real art can drop in by swapping the manifest
// entry for an image.
//
// The ring radii here are visual only — the scene scores hits using
// CACTUS_DARTS_CONFIG.ringRadii so a hit-detection update doesn't require
// re-rendering the texture.

export interface DartboardOptions {
  size?: number;
  ringColors?: {
    outer?: string;
    middle?: string;
    bullseye?: string;
    border?: string;
  };
}

export function dartboardSvg(opts: DartboardOptions = {}): string {
  const size = opts.size ?? 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  const outer = opts.ringColors?.outer ?? '#1f5a2d';
  const middle = opts.ringColors?.middle ?? '#f3e6c5';
  const bullseye = opts.ringColors?.bullseye ?? '#d24a3a';
  const border = opts.ringColors?.border ?? '#7a4d0c';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="db" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${bullseye}"/>
        <stop offset="18%" stop-color="${bullseye}"/>
        <stop offset="18%" stop-color="${middle}"/>
        <stop offset="45%" stop-color="${middle}"/>
        <stop offset="45%" stop-color="${outer}"/>
        <stop offset="95%" stop-color="${outer}"/>
      </radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#db)" stroke="${border}" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="${(r * 0.45).toFixed(2)}" fill="none" stroke="${border}" stroke-width="1.5" opacity="0.5"/>
    <circle cx="${cx}" cy="${cy}" r="${(r * 0.18).toFixed(2)}" fill="none" stroke="${border}" stroke-width="1.5" opacity="0.6"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
