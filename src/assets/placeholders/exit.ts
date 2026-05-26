export interface ExitOptions {
  size?: number;
}

export function exitSvg(opts: ExitOptions = {}): string {
  const size = opts.size ?? 48;
  const w = size;
  const h = size;
  // Sand-stone archway with an upward arrow.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="exit-stone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff5b7"/>
        <stop offset="100%" stop-color="#c9881f"/>
      </linearGradient>
    </defs>
    <path d="M ${(w * 0.18).toFixed(1)} ${h.toFixed(1)} L ${(w * 0.18).toFixed(1)} ${(h * 0.45).toFixed(1)}
             Q ${(w * 0.50).toFixed(1)} ${(h * 0.12).toFixed(1)} ${(w * 0.82).toFixed(1)} ${(h * 0.45).toFixed(1)}
             L ${(w * 0.82).toFixed(1)} ${h.toFixed(1)} Z"
      fill="url(#exit-stone)" stroke="#7a4d0c" stroke-width="2"/>
    <!-- Up arrow inside the arch -->
    <polygon points="${(w * 0.50).toFixed(1)},${(h * 0.30).toFixed(1)} ${(w * 0.30).toFixed(1)},${(h * 0.62).toFixed(1)} ${(w * 0.42).toFixed(1)},${(h * 0.62).toFixed(1)} ${(w * 0.42).toFixed(1)},${(h * 0.90).toFixed(1)} ${(w * 0.58).toFixed(1)},${(h * 0.90).toFixed(1)} ${(w * 0.58).toFixed(1)},${(h * 0.62).toFixed(1)} ${(w * 0.70).toFixed(1)},${(h * 0.62).toFixed(1)}"
      fill="#3aa07a" stroke="#1f5a2d" stroke-width="1.5"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
