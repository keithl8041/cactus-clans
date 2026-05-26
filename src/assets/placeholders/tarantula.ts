export interface TarantulaOptions {
  size?: number;
}

export function tarantulaSvg(opts: TarantulaOptions = {}): string {
  const size = opts.size ?? 78;
  const w = size;
  const h = size;
  const cx = w / 2;
  const cy = h / 2;
  const bodyR = w * 0.28;
  const eyeR = w * 0.045;
  const eyeY = cy - bodyR * 0.4;
  const eyeOffX = bodyR * 0.45;

  // 8 legs as line segments fanning out from the body.
  const legs: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * (i - 3.5)) / 6 + (i < 4 ? Math.PI : 0); // 4 left, 4 right
    const x1 = cx + Math.cos(a) * bodyR * 0.7;
    const y1 = cy + Math.sin(a) * bodyR * 0.7;
    const x2 = cx + Math.cos(a) * bodyR * 2.0;
    const y2 = cy + Math.sin(a) * bodyR * 2.0;
    legs.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#1a1a1a" stroke-width="3.5" stroke-linecap="round"/>`,
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${legs.join('\n    ')}
    <ellipse cx="${cx.toFixed(1)}" cy="${(cy + bodyR * 0.2).toFixed(1)}" rx="${(bodyR * 1.05).toFixed(1)}" ry="${(bodyR * 0.85).toFixed(1)}"
      fill="#2a1a1a" stroke="#5a2d1f" stroke-width="2"/>
    <ellipse cx="${cx.toFixed(1)}" cy="${(cy - bodyR * 0.3).toFixed(1)}" rx="${(bodyR * 0.75).toFixed(1)}" ry="${(bodyR * 0.55).toFixed(1)}"
      fill="#1a1a1a" stroke="#5a2d1f" stroke-width="2"/>
    <circle cx="${(cx - eyeOffX).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${eyeR.toFixed(1)}" fill="#d24a3a"/>
    <circle cx="${(cx + eyeOffX).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${eyeR.toFixed(1)}" fill="#d24a3a"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
