// Procedural placeholder for a "card" tile: a coloured panel with name and form number.

export interface ClanCardOptions {
  clanName: string;
  color: string;
  formName?: string;
  formNumber?: number;
  width?: number;
  height?: number;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// btoa only handles latin1. Encode UTF-8 first so unusual names survive.
function toBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

export function clanCardSvg(opts: ClanCardOptions): string {
  const w = opts.width ?? 200;
  const h = opts.height ?? 280;
  const titleY = 36;
  const formY = h - 24;
  const formText = opts.formName ?? (opts.formNumber != null ? `Form ${opts.formNumber}` : '');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${opts.color}" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.5"/>
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="12" fill="url(#bg)" stroke="#f3efe0" stroke-width="2"/>
    <text x="${w / 2}" y="${titleY}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#fff">${escape(opts.clanName)}</text>
    <rect x="20" y="${titleY + 12}" width="${w - 40}" height="${h - titleY - 60}" rx="8" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" fill="#f3efe0" opacity="0.6">art coming soon</text>
    <text x="${w / 2}" y="${formY}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#f7c948">${escape(formText)}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}
