export interface TrapOptions {
  size?: number;
}

export function trapSvg(opts: TrapOptions = {}): string {
  const size = opts.size ?? 32;
  const w = size;
  const h = size;
  // Three black spikes in a triangular cluster, sharp upward, with a darker
  // base patch so they read as embedded in the sand.
  const spike = (cx: number, cy: number, ht: number, wid: number) =>
    `<polygon points="${(cx - wid).toFixed(1)},${(cy + ht * 0.3).toFixed(1)} ${cx.toFixed(1)},${(cy - ht).toFixed(1)} ${(cx + wid).toFixed(1)},${(cy + ht * 0.3).toFixed(1)}" fill="#1a1a1a" stroke="#5a2d1f" stroke-width="1"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <ellipse cx="${(w / 2).toFixed(1)}" cy="${(h * 0.78).toFixed(1)}" rx="${(w * 0.40).toFixed(1)}" ry="${(h * 0.10).toFixed(1)}" fill="#3f3326" opacity="0.5"/>
    ${spike(w * 0.30, h * 0.75, h * 0.50, w * 0.07)}
    ${spike(w * 0.50, h * 0.78, h * 0.62, w * 0.08)}
    ${spike(w * 0.70, h * 0.75, h * 0.50, w * 0.07)}
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
