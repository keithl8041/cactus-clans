export interface WateringCanOptions {
  size?: number;
}

export function wateringCanSvg(opts: WateringCanOptions = {}): string {
  const size = opts.size ?? 72;
  const w = size;
  const h = size;
  // Body: rounded rect on the left. Spout: angled rectangle on the right.
  // Handle: arc above the body.
  const bodyX = w * 0.06;
  const bodyY = h * 0.30;
  const bodyW = w * 0.58;
  const bodyH = h * 0.55;

  const spoutBaseX = bodyX + bodyW;
  const spoutBaseY = bodyY + bodyH * 0.10;
  const spoutTipX = w * 0.96;
  const spoutTipY = h * 0.50;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="can-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#a3c8e6"/>
        <stop offset="100%" stop-color="#3a6db0"/>
      </linearGradient>
    </defs>
    <!-- spout -->
    <polygon
      points="${spoutBaseX.toFixed(1)},${spoutBaseY.toFixed(1)} ${spoutTipX.toFixed(1)},${spoutTipY.toFixed(1)} ${spoutTipX.toFixed(1)},${(spoutTipY + h * 0.08).toFixed(1)} ${spoutBaseX.toFixed(1)},${(spoutBaseY + h * 0.16).toFixed(1)}"
      fill="#5a8fc7" stroke="#243a5a" stroke-width="2" stroke-linejoin="round"/>
    <!-- body -->
    <rect x="${bodyX.toFixed(1)}" y="${bodyY.toFixed(1)}" width="${bodyW.toFixed(1)}" height="${bodyH.toFixed(1)}"
      rx="${(w * 0.08).toFixed(1)}" fill="url(#can-body)" stroke="#243a5a" stroke-width="2"/>
    <!-- handle -->
    <path d="M ${(bodyX + bodyW * 0.20).toFixed(1)} ${bodyY.toFixed(1)} Q ${(bodyX + bodyW * 0.50).toFixed(1)} ${(bodyY - h * 0.20).toFixed(1)} ${(bodyX + bodyW * 0.80).toFixed(1)} ${bodyY.toFixed(1)}"
      stroke="#243a5a" stroke-width="3" fill="none" stroke-linecap="round"/>
    <!-- water droplet at spout tip -->
    <ellipse cx="${(spoutTipX - 2).toFixed(1)}" cy="${(spoutTipY + h * 0.04).toFixed(1)}"
      rx="${(w * 0.035).toFixed(1)}" ry="${(w * 0.055).toFixed(1)}" fill="#7fbcef" stroke="#243a5a" stroke-width="1.2"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
