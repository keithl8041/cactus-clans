// Procedural placeholder character sprite — a chunky pixel-style figure that
// scales in size with form number. Used as the "you" avatar on the level map
// and during transitions. Real art replaces these via the manifest.

export interface CharacterOptions {
  clanColor: string;
  formNumber: number; // 1..8
  size?: number;
}

function toBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

export function characterSvg(opts: CharacterOptions): string {
  const size = opts.size ?? 96;
  const scale = 0.55 + (opts.formNumber - 1) * 0.06; // form 1 = small, form 8 = big
  const w = size;
  const h = size;
  const cx = w / 2;
  const cy = h / 2;
  const bodyR = (w / 2 - 8) * scale;
  const eyeOffset = bodyR * 0.35;
  const armLen = bodyR * 0.8;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <circle cx="${cx}" cy="${cy + bodyR * 0.6}" rx="${bodyR}" ry="${bodyR * 0.3}" fill="rgba(0,0,0,0.25)"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${bodyR}" ry="${bodyR * 1.1}" fill="${opts.clanColor}" stroke="#1a1a1a" stroke-width="2"/>
    <circle cx="${cx - eyeOffset}" cy="${cy - bodyR * 0.2}" r="${bodyR * 0.12}" fill="#fff"/>
    <circle cx="${cx + eyeOffset}" cy="${cy - bodyR * 0.2}" r="${bodyR * 0.12}" fill="#fff"/>
    <circle cx="${cx - eyeOffset}" cy="${cy - bodyR * 0.2}" r="${bodyR * 0.06}" fill="#1a1a1a"/>
    <circle cx="${cx + eyeOffset}" cy="${cy - bodyR * 0.2}" r="${bodyR * 0.06}" fill="#1a1a1a"/>
    <line x1="${cx - bodyR * 0.7}" y1="${cy + bodyR * 0.1}" x2="${cx - bodyR * 0.7 - armLen * 0.4}" y2="${cy + bodyR * 0.3}" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/>
    <line x1="${cx + bodyR * 0.7}" y1="${cy + bodyR * 0.1}" x2="${cx + bodyR * 0.7 + armLen * 0.4}" y2="${cy + bodyR * 0.3}" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/>
    <text x="${cx}" y="${cy + bodyR * 0.5}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${Math.max(10, bodyR * 0.4)}" font-weight="700" fill="#fff">${opts.formNumber}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}
