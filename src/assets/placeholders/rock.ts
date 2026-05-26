export interface RockOptions {
  size?: number;
  color?: string;
}

export function rockSvg(opts: RockOptions = {}): string {
  const size = opts.size ?? 80;
  const w = size;
  const h = size;
  const fill = opts.color ?? '#8e7556';
  const stroke = '#3f3326';

  // Lumpy pebble: rounded base + a couple of facets for shading.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <path d="M ${(w * 0.10).toFixed(1)} ${(h * 0.70).toFixed(1)}
             Q ${(w * 0.05).toFixed(1)} ${(h * 0.45).toFixed(1)} ${(w * 0.25).toFixed(1)} ${(h * 0.30).toFixed(1)}
             Q ${(w * 0.50).toFixed(1)} ${(h * 0.10).toFixed(1)} ${(w * 0.75).toFixed(1)} ${(h * 0.28).toFixed(1)}
             Q ${(w * 0.95).toFixed(1)} ${(h * 0.50).toFixed(1)} ${(w * 0.88).toFixed(1)} ${(h * 0.78).toFixed(1)}
             Q ${(w * 0.55).toFixed(1)} ${(h * 0.92).toFixed(1)} ${(w * 0.20).toFixed(1)} ${(h * 0.85).toFixed(1)}
             Z"
      fill="${fill}" stroke="${stroke}" stroke-width="2"/>
    <!-- highlight -->
    <ellipse cx="${(w * 0.42).toFixed(1)}" cy="${(h * 0.38).toFixed(1)}" rx="${(w * 0.15).toFixed(1)}" ry="${(h * 0.07).toFixed(1)}" fill="#ffffff" opacity="0.25"/>
    <!-- shadow underside -->
    <path d="M ${(w * 0.15).toFixed(1)} ${(h * 0.80).toFixed(1)} Q ${(w * 0.50).toFixed(1)} ${(h * 0.95).toFixed(1)} ${(w * 0.85).toFixed(1)} ${(h * 0.78).toFixed(1)}"
      stroke="${stroke}" stroke-width="2" fill="none" opacity="0.5"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
