export interface BreadcrumbOptions {
  size?: number;
}

export function breadcrumbSvg(opts: BreadcrumbOptions = {}): string {
  const size = opts.size ?? 12;
  const cx = size / 2;
  const cy = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${(size / 2 - 1).toFixed(1)}" fill="#fff5b7" opacity="0.65"/>
    <circle cx="${cx}" cy="${cy}" r="${(size / 2 - 2).toFixed(1)}" fill="none" stroke="#7a4d0c" stroke-width="0.8" opacity="0.5"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
