export interface SliceableCactusOptions {
  size?: number;
  small?: boolean;
  side?: 'whole' | 'left' | 'right';
}

export function sliceableCactusSvg(opts: SliceableCactusOptions = {}): string {
  const base = opts.size ?? 84;
  const size = opts.small ? base * 0.7 : base;
  const side = opts.side ?? 'whole';
  const w = size;
  const h = size;
  const cx = w / 2;

  const skin = '#3aa07a';
  const stroke = '#1f5a2d';
  const flesh = '#9efc9b';

  // Whole body is a barrel cactus with one little arm.
  const bodyTop = h * 0.16;
  const bodyBot = h * 0.92;
  const bodyW = w * 0.48;
  const armW = w * 0.20;
  const armH = h * 0.30;

  // For a half, we clip the cactus down the centerline and add a "cut" stripe
  // along the flat edge so it reads as recently sliced.
  let clipPath = '';
  let cutLine = '';
  if (side === 'left') {
    clipPath = `<clipPath id="half-clip"><rect x="0" y="0" width="${cx.toFixed(1)}" height="${h.toFixed(1)}"/></clipPath>`;
    cutLine = `<rect x="${(cx - 3).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="3" height="${(bodyBot - bodyTop).toFixed(1)}" fill="${flesh}" stroke="${stroke}" stroke-width="1.5"/>`;
  } else if (side === 'right') {
    clipPath = `<clipPath id="half-clip"><rect x="${cx.toFixed(1)}" y="0" width="${cx.toFixed(1)}" height="${h.toFixed(1)}"/></clipPath>`;
    cutLine = `<rect x="${cx.toFixed(1)}" y="${bodyTop.toFixed(1)}" width="3" height="${(bodyBot - bodyTop).toFixed(1)}" fill="${flesh}" stroke="${stroke}" stroke-width="1.5"/>`;
  }

  const wrapStart = side === 'whole' ? '' : '<g clip-path="url(#half-clip)">';
  const wrapEnd = side === 'whole' ? '' : '</g>';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>${clipPath}</defs>
    ${wrapStart}
    <rect x="${(cx + bodyW * 0.55).toFixed(1)}" y="${(h * 0.40).toFixed(1)}"
      width="${armW.toFixed(1)}" height="${armH.toFixed(1)}"
      rx="${(armW * 0.45).toFixed(1)}" fill="${skin}" stroke="${stroke}" stroke-width="2"/>
    <rect x="${(cx - bodyW / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}"
      width="${bodyW.toFixed(1)}" height="${(bodyBot - bodyTop).toFixed(1)}"
      rx="${(bodyW * 0.35).toFixed(1)}" fill="${skin}" stroke="${stroke}" stroke-width="2"/>
    <line x1="${cx.toFixed(1)}" y1="${(bodyTop + 8).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(bodyBot - 8).toFixed(1)}"
      stroke="${stroke}" stroke-width="1.5" opacity="0.5"/>
    ${wrapEnd}
    ${cutLine}
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
