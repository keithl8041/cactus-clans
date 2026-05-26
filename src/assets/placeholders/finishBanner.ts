export interface FinishBannerOptions {
  size?: number;
}

export function finishBannerSvg(opts: FinishBannerOptions = {}): string {
  const size = opts.size ?? 200;
  const w = size * 0.6;
  const h = size;

  // Two posts + checkered banner stretched between them, with "FINISH" label.
  const postW = w * 0.06;
  const postLeftX = w * 0.05;
  const postRightX = w * 0.89;
  const bannerY = h * 0.10;
  const bannerH = h * 0.35;
  const bannerLeft = postLeftX + postW;
  const bannerRight = postRightX;
  const bannerW = bannerRight - bannerLeft;

  // Checker squares (2 rows × 6 cols)
  const cols = 6;
  const rows = 2;
  const cellW = bannerW / cols;
  const cellH = bannerH / rows;
  const checks: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const fill = (r + c) % 2 === 0 ? '#1a1a1a' : '#f3efe0';
      checks.push(
        `<rect x="${(bannerLeft + c * cellW).toFixed(1)}" y="${(bannerY + r * cellH).toFixed(1)}" width="${cellW.toFixed(1)}" height="${cellH.toFixed(1)}" fill="${fill}"/>`,
      );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}">
    <!-- posts -->
    <rect x="${postLeftX.toFixed(1)}" y="0" width="${postW.toFixed(1)}" height="${h.toFixed(1)}" fill="#7a4d0c"/>
    <rect x="${postRightX.toFixed(1)}" y="0" width="${postW.toFixed(1)}" height="${h.toFixed(1)}" fill="#7a4d0c"/>
    <!-- checker banner -->
    ${checks.join('\n    ')}
    <rect x="${bannerLeft.toFixed(1)}" y="${bannerY.toFixed(1)}" width="${bannerW.toFixed(1)}" height="${bannerH.toFixed(1)}" fill="none" stroke="#3f3326" stroke-width="2"/>
    <!-- FINISH label below -->
    <text x="${(w / 2).toFixed(1)}" y="${(bannerY + bannerH + h * 0.13).toFixed(1)}" text-anchor="middle"
      font-family="system-ui, sans-serif" font-size="${(h * 0.12).toFixed(1)}" font-weight="bold"
      fill="#f7c948" stroke="#3f3326" stroke-width="2">FINISH</text>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
