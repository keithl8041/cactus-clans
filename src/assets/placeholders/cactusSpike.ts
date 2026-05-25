// Procedural cactus-spike placeholder. A pointy green triangle for the keepy-uppy.

export interface CactusSpikeOptions {
  height?: number;
  width?: number;
  /** Rotation in degrees: 0 = pointing up. Used by the scene to flip side spikes. */
  rotation?: number;
}

export function cactusSpikeSvg(opts: CactusSpikeOptions = {}): string {
  const w = opts.width ?? 64;
  const h = opts.height ?? 96;
  const rot = opts.rotation ?? 0;
  const cx = w / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <g transform="rotate(${rot} ${cx} ${h / 2})">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#2d6b3a"/>
          <stop offset="50%" stop-color="#4a8c54"/>
          <stop offset="100%" stop-color="#2d6b3a"/>
        </linearGradient>
      </defs>
      <polygon points="${cx},4 ${w - 4},${h - 4} 4,${h - 4}" fill="url(#cg)" stroke="#1a4a25" stroke-width="2" stroke-linejoin="round"/>
      <line x1="${cx}" y1="14" x2="${cx}" y2="${h - 12}" stroke="#1a4a25" stroke-width="1" opacity="0.5"/>
      <line x1="${cx - 8}" y1="${h * 0.45}" x2="${cx - 4}" y2="${h * 0.5}" stroke="#1a4a25" stroke-width="1.5"/>
      <line x1="${cx + 8}" y1="${h * 0.45}" x2="${cx + 4}" y2="${h * 0.5}" stroke="#1a4a25" stroke-width="1.5"/>
      <line x1="${cx - 12}" y1="${h * 0.7}" x2="${cx - 6}" y2="${h * 0.75}" stroke="#1a4a25" stroke-width="1.5"/>
      <line x1="${cx + 12}" y1="${h * 0.7}" x2="${cx + 6}" y2="${h * 0.75}" stroke="#1a4a25" stroke-width="1.5"/>
    </g>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
