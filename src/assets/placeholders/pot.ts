export interface PotOptions {
  size?: number;
}

export function potSvg(opts: PotOptions = {}): string {
  const size = opts.size ?? 110;
  // Terracotta pot: rounded trapezoid body + lip rectangle. A short cactus pokes
  // out the top so an idle pot reads as "occupied" before any lizard appears.
  const w = size;
  const h = size;
  const lipH = h * 0.18;
  const lipW = w * 0.92;
  const bodyTopW = w * 0.78;
  const bodyBotW = w * 0.58;
  const lipX = (w - lipW) / 2;
  const lipY = h * 0.30;
  const bodyTopY = lipY + lipH;
  const bodyBotY = h * 0.95;
  const bodyTopX1 = (w - bodyTopW) / 2;
  const bodyTopX2 = bodyTopX1 + bodyTopW;
  const bodyBotX1 = (w - bodyBotW) / 2;
  const bodyBotX2 = bodyBotX1 + bodyBotW;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="pot-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#c9744a"/>
        <stop offset="100%" stop-color="#8a4624"/>
      </linearGradient>
      <linearGradient id="pot-lip" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d9885d"/>
        <stop offset="100%" stop-color="#a85b34"/>
      </linearGradient>
    </defs>
    <polygon
      points="${bodyTopX1.toFixed(1)},${bodyTopY.toFixed(1)} ${bodyTopX2.toFixed(1)},${bodyTopY.toFixed(1)} ${bodyBotX2.toFixed(1)},${bodyBotY.toFixed(1)} ${bodyBotX1.toFixed(1)},${bodyBotY.toFixed(1)}"
      fill="url(#pot-body)" stroke="#5a2d1f" stroke-width="2" stroke-linejoin="round"/>
    <rect x="${lipX.toFixed(1)}" y="${lipY.toFixed(1)}" width="${lipW.toFixed(1)}" height="${lipH.toFixed(1)}"
      rx="4" fill="url(#pot-lip)" stroke="#5a2d1f" stroke-width="2"/>
    <ellipse cx="${(w / 2).toFixed(1)}" cy="${(lipY - h * 0.04).toFixed(1)}" rx="${(w * 0.12).toFixed(1)}" ry="${(h * 0.18).toFixed(1)}"
      fill="#3aa07a" stroke="#1f5a2d" stroke-width="2"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
