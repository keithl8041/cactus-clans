export interface PetCactusOptions {
  size?: number;
  clanColor?: string;
  mood?: 'happy' | 'sad' | 'drown';
}

export function petCactusSvg(opts: PetCactusOptions = {}): string {
  const size = opts.size ?? 160;
  const body = opts.clanColor ?? '#3aa07a';
  // Darken the body slightly for the stripe/arm shading.
  const shade = '#1f5a2d';

  const w = size;
  const h = size;
  const cx = w / 2;
  const bodyTop = h * 0.18;
  const bodyBot = h * 0.92;
  const bodyW = w * 0.46;

  // Eyes + mouth — happy by default. (mood param accepted but only 'happy' is rendered for v1.)
  const eyeY = h * 0.42;
  const eyeR = w * 0.035;
  const eyeOffX = w * 0.085;
  const mouthY = h * 0.55;
  const mouthW = w * 0.10;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="cactus-body" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${shade}"/>
        <stop offset="50%" stop-color="${body}"/>
        <stop offset="100%" stop-color="${shade}"/>
      </linearGradient>
    </defs>
    <!-- arms -->
    <rect x="${(cx - bodyW * 0.95).toFixed(1)}" y="${(h * 0.50).toFixed(1)}"
      width="${(bodyW * 0.32).toFixed(1)}" height="${(h * 0.25).toFixed(1)}"
      rx="${(bodyW * 0.16).toFixed(1)}" fill="${body}" stroke="${shade}" stroke-width="2"/>
    <rect x="${(cx + bodyW * 0.65).toFixed(1)}" y="${(h * 0.46).toFixed(1)}"
      width="${(bodyW * 0.30).toFixed(1)}" height="${(h * 0.20).toFixed(1)}"
      rx="${(bodyW * 0.15).toFixed(1)}" fill="${body}" stroke="${shade}" stroke-width="2"/>
    <!-- body -->
    <rect x="${(cx - bodyW / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}"
      width="${bodyW.toFixed(1)}" height="${(bodyBot - bodyTop).toFixed(1)}"
      rx="${(bodyW * 0.35).toFixed(1)}" fill="url(#cactus-body)" stroke="${shade}" stroke-width="2"/>
    <!-- vertical ribs (decorative) -->
    <line x1="${cx.toFixed(1)}" y1="${(bodyTop + 8).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(bodyBot - 8).toFixed(1)}"
      stroke="${shade}" stroke-width="1.5" opacity="0.6"/>
    <line x1="${(cx - bodyW * 0.22).toFixed(1)}" y1="${(bodyTop + 18).toFixed(1)}" x2="${(cx - bodyW * 0.22).toFixed(1)}" y2="${(bodyBot - 18).toFixed(1)}"
      stroke="${shade}" stroke-width="1.2" opacity="0.4"/>
    <line x1="${(cx + bodyW * 0.22).toFixed(1)}" y1="${(bodyTop + 18).toFixed(1)}" x2="${(cx + bodyW * 0.22).toFixed(1)}" y2="${(bodyBot - 18).toFixed(1)}"
      stroke="${shade}" stroke-width="1.2" opacity="0.4"/>
    <!-- face -->
    <circle cx="${(cx - eyeOffX).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${eyeR.toFixed(1)}" fill="#1a1a1a"/>
    <circle cx="${(cx + eyeOffX).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${eyeR.toFixed(1)}" fill="#1a1a1a"/>
    <path d="M ${(cx - mouthW).toFixed(1)} ${mouthY.toFixed(1)} Q ${cx.toFixed(1)} ${(mouthY + h * 0.045).toFixed(1)} ${(cx + mouthW).toFixed(1)} ${mouthY.toFixed(1)}"
      stroke="#1a1a1a" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
