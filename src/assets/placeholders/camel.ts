export interface CamelOptions {
  size?: number;
  clanColor?: string;
}

export function camelSvg(opts: CamelOptions = {}): string {
  const size = opts.size ?? 110;
  const body = opts.clanColor ?? '#c9974a';
  const shade = '#7a4d0c';

  // Side-view camel facing right. Aspect ~1.4:1; SVG canvas is square so the
  // unused space sits as transparent margins.
  const w = size * 1.4;
  const h = size;
  const bodyX = w * 0.20;
  const bodyY = h * 0.45;
  const bodyW = w * 0.55;
  const bodyH = h * 0.30;
  // Hump on top of body
  const humpCx = bodyX + bodyW * 0.5;
  const humpCy = bodyY;
  const humpRx = bodyW * 0.30;
  const humpRy = h * 0.18;
  // Neck + head pointing right
  const neckX1 = bodyX + bodyW * 0.85;
  const neckY1 = bodyY + bodyH * 0.20;
  const neckX2 = w * 0.86;
  const neckY2 = h * 0.20;
  const headCx = w * 0.90;
  const headCy = h * 0.18;
  // Legs
  const legY = bodyY + bodyH;
  const legBot = h * 0.92;
  const legW = w * 0.04;
  const legX1 = bodyX + bodyW * 0.18;
  const legX2 = bodyX + bodyW * 0.70;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}">
    <!-- back legs (drawn first so they sit behind) -->
    <rect x="${(legX2 - legW * 0.5).toFixed(1)}" y="${legY.toFixed(1)}" width="${legW.toFixed(1)}" height="${(legBot - legY).toFixed(1)}" fill="${shade}" stroke="${shade}" stroke-width="1"/>
    <rect x="${(legX1 - legW * 0.5).toFixed(1)}" y="${legY.toFixed(1)}" width="${legW.toFixed(1)}" height="${(legBot - legY).toFixed(1)}" fill="${shade}" stroke="${shade}" stroke-width="1"/>
    <!-- body -->
    <ellipse cx="${(bodyX + bodyW / 2).toFixed(1)}" cy="${(bodyY + bodyH / 2).toFixed(1)}" rx="${(bodyW / 2).toFixed(1)}" ry="${(bodyH / 2).toFixed(1)}" fill="${body}" stroke="${shade}" stroke-width="2"/>
    <!-- hump -->
    <ellipse cx="${humpCx.toFixed(1)}" cy="${humpCy.toFixed(1)}" rx="${humpRx.toFixed(1)}" ry="${humpRy.toFixed(1)}" fill="${body}" stroke="${shade}" stroke-width="2"/>
    <!-- neck -->
    <line x1="${neckX1.toFixed(1)}" y1="${neckY1.toFixed(1)}" x2="${neckX2.toFixed(1)}" y2="${neckY2.toFixed(1)}" stroke="${body}" stroke-width="${(h * 0.10).toFixed(1)}" stroke-linecap="round"/>
    <line x1="${neckX1.toFixed(1)}" y1="${neckY1.toFixed(1)}" x2="${neckX2.toFixed(1)}" y2="${neckY2.toFixed(1)}" stroke="${shade}" stroke-width="2" fill="none" opacity="0.4"/>
    <!-- head -->
    <ellipse cx="${headCx.toFixed(1)}" cy="${headCy.toFixed(1)}" rx="${(w * 0.07).toFixed(1)}" ry="${(h * 0.08).toFixed(1)}" fill="${body}" stroke="${shade}" stroke-width="2"/>
    <circle cx="${(headCx - w * 0.01).toFixed(1)}" cy="${(headCy - h * 0.01).toFixed(1)}" r="${(h * 0.014).toFixed(1)}" fill="#1a1a1a"/>
    <!-- tail -->
    <line x1="${bodyX.toFixed(1)}" y1="${(bodyY + bodyH * 0.3).toFixed(1)}" x2="${(bodyX - w * 0.05).toFixed(1)}" y2="${(bodyY + bodyH * 0.5).toFixed(1)}" stroke="${shade}" stroke-width="3" stroke-linecap="round"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
