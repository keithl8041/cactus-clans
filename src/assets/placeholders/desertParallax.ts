export interface DesertParallaxOptions {
  width?: number;
  height?: number;
  layer?: 'far' | 'mid' | 'near';
}

export function desertParallaxSvg(opts: DesertParallaxOptions = {}): string {
  const w = opts.width ?? 1024;
  const h = opts.height ?? 240;
  const layer = opts.layer ?? 'mid';

  // Each layer is a horizontally-tileable SVG. The left and right edges meet
  // because we anchor the silhouette curves at y = top and y = bottom on both
  // x=0 and x=w. Mid-curve undulations sit safely away from the edges.

  let dunes: string;
  let fill: string;
  let baseY: number;
  if (layer === 'far') {
    fill = '#d6a892';
    baseY = h * 0.65;
    dunes = `<path d="M 0 ${h} L 0 ${baseY.toFixed(1)}
      Q ${(w * 0.12).toFixed(1)} ${(baseY - h * 0.20).toFixed(1)} ${(w * 0.25).toFixed(1)} ${baseY.toFixed(1)}
      Q ${(w * 0.40).toFixed(1)} ${(baseY - h * 0.10).toFixed(1)} ${(w * 0.55).toFixed(1)} ${baseY.toFixed(1)}
      Q ${(w * 0.68).toFixed(1)} ${(baseY - h * 0.25).toFixed(1)} ${(w * 0.80).toFixed(1)} ${baseY.toFixed(1)}
      Q ${(w * 0.92).toFixed(1)} ${(baseY - h * 0.12).toFixed(1)} ${w.toFixed(1)} ${baseY.toFixed(1)}
      L ${w.toFixed(1)} ${h} Z" fill="${fill}"/>`;
  } else if (layer === 'mid') {
    fill = '#c0814a';
    baseY = h * 0.55;
    dunes = `<path d="M 0 ${h} L 0 ${baseY.toFixed(1)}
      Q ${(w * 0.10).toFixed(1)} ${(baseY - h * 0.30).toFixed(1)} ${(w * 0.22).toFixed(1)} ${baseY.toFixed(1)}
      Q ${(w * 0.34).toFixed(1)} ${(baseY - h * 0.18).toFixed(1)} ${(w * 0.50).toFixed(1)} ${baseY.toFixed(1)}
      Q ${(w * 0.65).toFixed(1)} ${(baseY - h * 0.32).toFixed(1)} ${(w * 0.78).toFixed(1)} ${baseY.toFixed(1)}
      Q ${(w * 0.90).toFixed(1)} ${(baseY - h * 0.20).toFixed(1)} ${w.toFixed(1)} ${baseY.toFixed(1)}
      L ${w.toFixed(1)} ${h} Z" fill="${fill}"/>`;
  } else {
    fill = '#8a5a2d';
    baseY = h * 0.40;
    // Foreground sand strip — short undulations plus little tuft circles.
    dunes = `<path d="M 0 ${h} L 0 ${baseY.toFixed(1)}
      Q ${(w * 0.08).toFixed(1)} ${(baseY - h * 0.10).toFixed(1)} ${(w * 0.18).toFixed(1)} ${baseY.toFixed(1)}
      Q ${(w * 0.30).toFixed(1)} ${(baseY - h * 0.18).toFixed(1)} ${(w * 0.42).toFixed(1)} ${baseY.toFixed(1)}
      Q ${(w * 0.55).toFixed(1)} ${(baseY - h * 0.08).toFixed(1)} ${(w * 0.65).toFixed(1)} ${baseY.toFixed(1)}
      Q ${(w * 0.78).toFixed(1)} ${(baseY - h * 0.16).toFixed(1)} ${(w * 0.88).toFixed(1)} ${baseY.toFixed(1)}
      Q ${(w * 0.95).toFixed(1)} ${(baseY - h * 0.08).toFixed(1)} ${w.toFixed(1)} ${baseY.toFixed(1)}
      L ${w.toFixed(1)} ${h} Z" fill="${fill}"/>
      <ellipse cx="${(w * 0.15).toFixed(1)}" cy="${(baseY + h * 0.20).toFixed(1)}" rx="${(w * 0.012).toFixed(1)}" ry="${(h * 0.04).toFixed(1)}" fill="#3f8b3a" opacity="0.7"/>
      <ellipse cx="${(w * 0.48).toFixed(1)}" cy="${(baseY + h * 0.30).toFixed(1)}" rx="${(w * 0.014).toFixed(1)}" ry="${(h * 0.05).toFixed(1)}" fill="#3f8b3a" opacity="0.7"/>
      <ellipse cx="${(w * 0.82).toFixed(1)}" cy="${(baseY + h * 0.25).toFixed(1)}" rx="${(w * 0.012).toFixed(1)}" ry="${(h * 0.045).toFixed(1)}" fill="#3f8b3a" opacity="0.7"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    ${dunes}
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
