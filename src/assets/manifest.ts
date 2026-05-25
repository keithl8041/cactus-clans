// Central asset registry. Every sprite, card frame, and avatar is referenced
// by a stable key from this manifest. Today every entry is a procedural SVG
// placeholder. Replacing a placeholder with real art is a one-line change:
//
//   'balloon': { kind: 'png', src: '/art/balloon.png' }
//
// Phaser scenes call `loadManifestKey(this, 'balloon', ...)` in their
// preload() rather than hard-coding URLs. React components render
// `assetUrl('balloon', opts)` instead.

import { balloonSvg, type BalloonOptions } from './placeholders/balloon';
import { cactusSpikeSvg, type CactusSpikeOptions } from './placeholders/cactusSpike';
import { clanCardSvg, type ClanCardOptions } from './placeholders/clanCard';
import { characterSvg, type CharacterOptions } from './placeholders/character';

export type AssetOptions =
  | BalloonOptions
  | CactusSpikeOptions
  | ClanCardOptions
  | CharacterOptions
  | undefined;

export type AssetEntry =
  | { kind: 'svg'; generate: (opts?: AssetOptions) => string }
  | { kind: 'png'; src: string };

export const ASSETS: Record<string, AssetEntry> = {
  balloon: { kind: 'svg', generate: (opts) => balloonSvg(opts as BalloonOptions) },
  'cactus.spike': { kind: 'svg', generate: (opts) => cactusSpikeSvg(opts as CactusSpikeOptions) },
  'card.frame': { kind: 'svg', generate: (opts) => clanCardSvg(opts as ClanCardOptions) },
  character: { kind: 'svg', generate: (opts) => characterSvg(opts as CharacterOptions) },
};

/** Resolve a manifest key to a URL (data URL for SVG, file path for PNG). */
export function assetUrl(key: string, opts?: AssetOptions): string {
  const entry = ASSETS[key];
  if (!entry) throw new Error(`Unknown asset: ${key}`);
  return entry.kind === 'svg' ? entry.generate(opts) : entry.src;
}
