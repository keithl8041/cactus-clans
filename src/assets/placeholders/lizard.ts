export interface LizardOptions {
  size?: number;
  pose?: 'up' | 'down';
  bandit?: boolean;
}

export function lizardSvg(opts: LizardOptions = {}): string {
  const size = opts.size ?? 96;
  const pose = opts.pose ?? 'up';
  const bandit = opts.bandit ?? false;

  const bodyFill = bandit ? '#f7c948' : '#6bbf5a';
  const bodyStroke = bandit ? '#7a4d0c' : '#2f6a2c';
  const accentFill = bandit ? '#c9881f' : '#3f8b3a';
  const eyeFill = '#1a1a1a';

  const w = size;
  const h = size;
  const cx = w / 2;
  // 'down' pose tucks the head deep into the pot — small silhouette near the bottom.
  const headRy = pose === 'up' ? h * 0.22 : h * 0.10;
  const headCy = pose === 'up' ? h * 0.38 : h * 0.78;
  const headRx = w * 0.30;
  // Body is a shorter ellipse below the head, mostly hidden when pose is 'down'.
  const bodyRy = pose === 'up' ? h * 0.18 : h * 0.05;
  const bodyCy = headCy + headRy * 0.9;
  const eyeRadius = w * 0.045;
  const eyeY = headCy - headRy * 0.20;
  const eyeOffsetX = headRx * 0.45;

  const maskRect = bandit && pose === 'up'
    ? `<rect x="${(cx - headRx * 0.78).toFixed(1)}" y="${(eyeY - eyeRadius * 1.4).toFixed(1)}"
         width="${(headRx * 1.56).toFixed(1)}" height="${(eyeRadius * 2.4).toFixed(1)}"
         rx="3" fill="#1a1a1a" opacity="0.85"/>`
    : '';

  const eyes = pose === 'up'
    ? `<circle cx="${(cx - eyeOffsetX).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${eyeRadius.toFixed(1)}" fill="#fff"/>
       <circle cx="${(cx + eyeOffsetX).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${eyeRadius.toFixed(1)}" fill="#fff"/>
       <circle cx="${(cx - eyeOffsetX).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${(eyeRadius * 0.55).toFixed(1)}" fill="${eyeFill}"/>
       <circle cx="${(cx + eyeOffsetX).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${(eyeRadius * 0.55).toFixed(1)}" fill="${eyeFill}"/>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <ellipse cx="${cx.toFixed(1)}" cy="${bodyCy.toFixed(1)}" rx="${(headRx * 0.85).toFixed(1)}" ry="${bodyRy.toFixed(1)}"
      fill="${accentFill}" stroke="${bodyStroke}" stroke-width="2"/>
    <ellipse cx="${cx.toFixed(1)}" cy="${headCy.toFixed(1)}" rx="${headRx.toFixed(1)}" ry="${headRy.toFixed(1)}"
      fill="${bodyFill}" stroke="${bodyStroke}" stroke-width="2"/>
    ${maskRect}
    ${eyes}
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
