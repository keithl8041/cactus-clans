export interface WaterFlaskOptions {
  size?: number;
}

export function waterFlaskSvg(opts: WaterFlaskOptions = {}): string {
  const size = opts.size ?? 48;
  const w = size;
  const h = size;
  const cx = w / 2;
  const bodyTop = h * 0.18;
  const bodyBot = h * 0.92;
  const bodyW = w * 0.62;
  const necW = w * 0.30;
  const necTop = h * 0.05;
  const necH = bodyTop - necTop + h * 0.02;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="flask" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#a3c8e6"/>
        <stop offset="100%" stop-color="#3a6db0"/>
      </linearGradient>
    </defs>
    <!-- strap -->
    <rect x="${(cx - bodyW * 0.55).toFixed(1)}" y="${(bodyTop + bodyW * 0.10).toFixed(1)}" width="${(bodyW * 1.1).toFixed(1)}" height="${(h * 0.06).toFixed(1)}" fill="#7a4d0c" opacity="0.85"/>
    <!-- neck -->
    <rect x="${(cx - necW / 2).toFixed(1)}" y="${necTop.toFixed(1)}" width="${necW.toFixed(1)}" height="${necH.toFixed(1)}" rx="${(necW * 0.20).toFixed(1)}" fill="#5a8fc7" stroke="#243a5a" stroke-width="2"/>
    <!-- body -->
    <rect x="${(cx - bodyW / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${bodyW.toFixed(1)}" height="${(bodyBot - bodyTop).toFixed(1)}" rx="${(bodyW * 0.30).toFixed(1)}" fill="url(#flask)" stroke="#243a5a" stroke-width="2"/>
    <!-- water highlight -->
    <ellipse cx="${(cx - bodyW * 0.18).toFixed(1)}" cy="${(bodyTop + (bodyBot - bodyTop) * 0.32).toFixed(1)}" rx="${(bodyW * 0.12).toFixed(1)}" ry="${(h * 0.10).toFixed(1)}" fill="#ffffff" opacity="0.5"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
