// Central asset registry. Every sprite, card frame, and avatar is referenced
// by a stable key from this manifest. Entries are either a procedural SVG
// placeholder or a static image file (PNG or SVG) served from /public.
// Replacing a placeholder with real art is a one-line change:
//
//   'balloon': { kind: 'image', src: '/art/balloon.png' }
//
// Phaser scenes call `loadAsset(this, 'balloon', ...)` in their preload()
// rather than hard-coding URLs. React components render `assetUrl('balloon',
// opts)` instead. For per-clan/per-form variants, use `resolveBalloonKey` /
// `resolveCharacterKey` so callers automatically fall back to the procedural
// placeholder when clan-specific art hasn't landed yet.

import { balloonSvg, type BalloonOptions } from './placeholders/balloon';
import { clanCardSvg, type ClanCardOptions } from './placeholders/clanCard';
import { characterSvg, type CharacterOptions } from './placeholders/character';
import { dartboardSvg, type DartboardOptions } from './placeholders/dartboard';
import { hitSplatSvg, type HitSplatOptions } from './placeholders/hitSplat';
import { lizardSvg, type LizardOptions } from './placeholders/lizard';
import { petCactusSvg, type PetCactusOptions } from './placeholders/petCactus';
import { potSvg, type PotOptions } from './placeholders/pot';
import { rainOverlaySvg, type RainOverlayOptions } from './placeholders/rainOverlay';
import { starSvg, type StarOptions } from './placeholders/star';
import { sunOverlaySvg, type SunOverlayOptions } from './placeholders/sunOverlay';
import { wateringCanSvg, type WateringCanOptions } from './placeholders/wateringCan';

export type AssetOptions =
  | BalloonOptions
  | ClanCardOptions
  | CharacterOptions
  | DartboardOptions
  | HitSplatOptions
  | LizardOptions
  | PetCactusOptions
  | PotOptions
  | RainOverlayOptions
  | StarOptions
  | SunOverlayOptions
  | WateringCanOptions
  | undefined;

export type AssetEntry =
  | { kind: 'svg'; generate: (opts?: AssetOptions) => string }
  | { kind: 'image'; src: string };

export const ASSETS: Record<string, AssetEntry> = {
  balloon: { kind: 'svg', generate: (opts) => balloonSvg(opts as BalloonOptions) },
  'balloon.prickling': { kind: 'image', src: '/art/balloon-prickling-clan.png' },
  'cactus.spike': { kind: 'image', src: '/art/cactus-spike.svg' },
  'card.frame': { kind: 'svg', generate: (opts) => clanCardSvg(opts as ClanCardOptions) },
  dartboard: { kind: 'svg', generate: (opts) => dartboardSvg(opts as DartboardOptions) },
  character: { kind: 'svg', generate: (opts) => characterSvg(opts as CharacterOptions) },
  'character.prickling.1': { kind: 'image', src: '/art/prickling-prickling-clan-form1.png' },
  'character.prickling.8': { kind: 'image', src: '/art/desert-titan-prickling-clan-form8.png' },
  'hit.splat': { kind: 'svg', generate: (opts) => hitSplatSvg(opts as HitSplatOptions) },
  'lizard.up': { kind: 'svg', generate: (opts) => lizardSvg({ ...(opts as LizardOptions), pose: 'up' }) },
  'lizard.down': { kind: 'svg', generate: (opts) => lizardSvg({ ...(opts as LizardOptions), pose: 'down' }) },
  'lizard.bandit': { kind: 'svg', generate: (opts) => lizardSvg({ ...(opts as LizardOptions), pose: 'up', bandit: true }) },
  'cactus.pet': { kind: 'svg', generate: (opts) => petCactusSvg(opts as PetCactusOptions) },
  pot: { kind: 'svg', generate: (opts) => potSvg(opts as PotOptions) },
  rainOverlay: { kind: 'svg', generate: (opts) => rainOverlaySvg(opts as RainOverlayOptions) },
  star: { kind: 'svg', generate: (opts) => starSvg(opts as StarOptions) },
  sunOverlay: { kind: 'svg', generate: (opts) => sunOverlaySvg(opts as SunOverlayOptions) },
  wateringCan: { kind: 'svg', generate: (opts) => wateringCanSvg(opts as WateringCanOptions) },
};

/** Resolve a manifest key to a URL (data URL for SVG, file path for image). */
export function assetUrl(key: string, opts?: AssetOptions): string {
  const entry = ASSETS[key];
  if (!entry) throw new Error(`Unknown asset: ${key}`);
  return entry.kind === 'svg' ? entry.generate(opts) : entry.src;
}

/** "Prickling Clan" → "prickling". Used to look up clan-specific asset keys. */
function clanAssetSlug(clanName: string): string {
  return clanName.toLowerCase().replace(/\s+clan$/, '').replace(/\s+/g, '-');
}

/** Returns the clan-specific balloon key if registered, else the generic placeholder. */
export function resolveBalloonKey(clanName: string): string {
  const key = `balloon.${clanAssetSlug(clanName)}`;
  return key in ASSETS ? key : 'balloon';
}

/** Returns the clan+form-specific character key if registered, else the generic placeholder. */
export function resolveCharacterKey(clanName: string, formNumber: number): string {
  const key = `character.${clanAssetSlug(clanName)}.${formNumber}`;
  return key in ASSETS ? key : 'character';
}
