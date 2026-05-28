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

import { artifactSvg, type ArtifactOptions } from './placeholders/artifact';
import { balloonSvg, type BalloonOptions } from './placeholders/balloon';
import { breadcrumbSvg, type BreadcrumbOptions } from './placeholders/breadcrumb';
import { camelSvg, type CamelOptions } from './placeholders/camel';
import { clanCardSvg, type ClanCardOptions } from './placeholders/clanCard';
import { characterSvg, type CharacterOptions } from './placeholders/character';
import { dartboardSvg, type DartboardOptions } from './placeholders/dartboard';
import { desertParallaxSvg, type DesertParallaxOptions } from './placeholders/desertParallax';
import { duneFloorSvg, type DuneFloorOptions } from './placeholders/duneFloor';
import { duneWallSvg, type DuneWallOptions } from './placeholders/duneWall';
import { exitSvg, type ExitOptions } from './placeholders/exit';
import { finishBannerSvg, type FinishBannerOptions } from './placeholders/finishBanner';
import { hitSplatSvg, type HitSplatOptions } from './placeholders/hitSplat';
import { lizardSvg, type LizardOptions } from './placeholders/lizard';
import { petCactusSvg, type PetCactusOptions } from './placeholders/petCactus';
import { potSvg, type PotOptions } from './placeholders/pot';
import { quicksandSvg, type QuicksandOptions } from './placeholders/quicksand';
import { rainOverlaySvg, type RainOverlayOptions } from './placeholders/rainOverlay';
import { rockSvg, type RockOptions } from './placeholders/rock';
import { sliceableCactusSvg, type SliceableCactusOptions } from './placeholders/sliceableCactus';
import { starSvg, type StarOptions } from './placeholders/star';
import { sunOverlaySvg, type SunOverlayOptions } from './placeholders/sunOverlay';
import { tarantulaSvg, type TarantulaOptions } from './placeholders/tarantula';
import { trapSvg, type TrapOptions } from './placeholders/trap';
import { waterFlaskSvg, type WaterFlaskOptions } from './placeholders/waterFlask';
import { wateringCanSvg, type WateringCanOptions } from './placeholders/wateringCan';

export type AssetOptions =
  | ArtifactOptions
  | BalloonOptions
  | BreadcrumbOptions
  | CamelOptions
  | ClanCardOptions
  | CharacterOptions
  | DartboardOptions
  | DesertParallaxOptions
  | DuneFloorOptions
  | DuneWallOptions
  | ExitOptions
  | FinishBannerOptions
  | HitSplatOptions
  | LizardOptions
  | PetCactusOptions
  | PotOptions
  | QuicksandOptions
  | RainOverlayOptions
  | RockOptions
  | SliceableCactusOptions
  | StarOptions
  | SunOverlayOptions
  | TarantulaOptions
  | TrapOptions
  | WaterFlaskOptions
  | WateringCanOptions
  | undefined;

export type AssetEntry =
  | { kind: 'svg'; generate: (opts?: AssetOptions) => string }
  | { kind: 'image'; src: string };

export const ASSETS: Record<string, AssetEntry> = {
  balloon: { kind: 'svg', generate: (opts) => balloonSvg(opts as BalloonOptions) },
  'balloon.prickling': { kind: 'image', src: '/art/balloon-prickling-clan.png' },
  'cactus.spike': { kind: 'image', src: '/art/cactus-spike.png' },
  'card.frame': { kind: 'svg', generate: (opts) => clanCardSvg(opts as ClanCardOptions) },
  'card.prickling.1': { kind: 'image', src: '/art/card-prickling-clan-form1.png' },
  'card.prickling.2': { kind: 'image', src: '/art/card-prickling-clan-form2.png' },
  'card.prickling.3': { kind: 'image', src: '/art/card-prickling-clan-form3.png' },
  'card.prickling.4': { kind: 'image', src: '/art/card-prickling-clan-form4.png' },
  'card.prickling.5': { kind: 'image', src: '/art/card-prickling-clan-form5.png' },
  'card.prickling.6': { kind: 'image', src: '/art/card-prickling-clan-form6.png' },
  'card.prickling.7': { kind: 'image', src: '/art/card-prickling-clan-form7.png' },
  'card.prickling.8': { kind: 'image', src: '/art/card-prickling-clan-form8.png' },
  'card.duskerns.1': { kind: 'image', src: '/art/card-duskern-clan-form1.png' },
  'card.tumbleweed.1': { kind: 'image', src: '/art/card-tumbleweed-clan-form1.png' },
  'card.camo.1': { kind: 'image', src: '/art/card-camo-clan-form1.png' },
  'card.earth.1': { kind: 'image', src: '/art/card-earth-clan-form1.png' },
  'card.hot-dog.1': { kind: 'image', src: '/art/card-hotdog-clan-form1.png' },
  'card.metal.1': { kind: 'image', src: '/art/card-metal-clan-form1.png' },
  'card.oasis.1': { kind: 'image', src: '/art/card-oasis-clan-form1.png' },
  'card.tropica.1': { kind: 'image', src: '/art/card-tropica-clan-form1.png' },
  'card.wildfire.1': { kind: 'image', src: '/art/card-wildfire-clan-form1.png' },
  'game1.background': { kind: 'image', src: '/art/game1background.png' },
  'game1.floor': { kind: 'image', src: '/art/Game1Floor.png' },
  dartboard: { kind: 'svg', generate: (opts) => dartboardSvg(opts as DartboardOptions) },
  character: { kind: 'svg', generate: (opts) => characterSvg(opts as CharacterOptions) },
  'character.prickling.1': { kind: 'image', src: '/art/prickling-prickling-clan-form1.png' },
  'character.prickling.2': { kind: 'image', src: '/art/spiket-prickling-clan-form2.png' },
  'character.prickling.3': { kind: 'image', src: '/art/bloomguard-prickling-clan-form3.png' },
  'character.prickling.4': { kind: 'image', src: '/art/sunspire-prickling-clan-form4.png' },
  'character.prickling.5': { kind: 'image', src: '/art/sandstalker-prickling-clan-form5.png' },
  'character.prickling.6': { kind: 'image', src: '/art/prickshot-prickling-clan-form6.png' },
  'character.prickling.7': { kind: 'image', src: '/art/thorncrown-prickling-clan-form7.png' },
  'character.prickling.8': { kind: 'image', src: '/art/desert-titan-prickling-clan-form8.png' },
  'hit.splat': { kind: 'svg', generate: (opts) => hitSplatSvg(opts as HitSplatOptions) },
  'lizard.up': { kind: 'svg', generate: (opts) => lizardSvg({ ...(opts as LizardOptions), pose: 'up' }) },
  'lizard.down': { kind: 'svg', generate: (opts) => lizardSvg({ ...(opts as LizardOptions), pose: 'down' }) },
  'lizard.bandit': { kind: 'svg', generate: (opts) => lizardSvg({ ...(opts as LizardOptions), pose: 'up', bandit: true }) },
  'cactus.pet': { kind: 'svg', generate: (opts) => petCactusSvg(opts as PetCactusOptions) },
  'cactus.whole': { kind: 'svg', generate: (opts) => sliceableCactusSvg({ ...(opts as SliceableCactusOptions), side: 'whole' }) },
  'cactus.half.left': { kind: 'svg', generate: (opts) => sliceableCactusSvg({ ...(opts as SliceableCactusOptions), side: 'left' }) },
  'cactus.half.right': { kind: 'svg', generate: (opts) => sliceableCactusSvg({ ...(opts as SliceableCactusOptions), side: 'right' }) },
  pot: { kind: 'svg', generate: (opts) => potSvg(opts as PotOptions) },
  rainOverlay: { kind: 'svg', generate: (opts) => rainOverlaySvg(opts as RainOverlayOptions) },
  star: { kind: 'svg', generate: (opts) => starSvg(opts as StarOptions) },
  sunOverlay: { kind: 'svg', generate: (opts) => sunOverlaySvg(opts as SunOverlayOptions) },
  tarantula: { kind: 'svg', generate: (opts) => tarantulaSvg(opts as TarantulaOptions) },
  camel: { kind: 'svg', generate: (opts) => camelSvg(opts as CamelOptions) },
  rock: { kind: 'svg', generate: (opts) => rockSvg(opts as RockOptions) },
  waterFlask: { kind: 'svg', generate: (opts) => waterFlaskSvg(opts as WaterFlaskOptions) },
  'desert.parallax.far': { kind: 'svg', generate: (opts) => desertParallaxSvg({ ...(opts as DesertParallaxOptions), layer: 'far' }) },
  'desert.parallax.mid': { kind: 'svg', generate: (opts) => desertParallaxSvg({ ...(opts as DesertParallaxOptions), layer: 'mid' }) },
  'desert.parallax.near': { kind: 'svg', generate: (opts) => desertParallaxSvg({ ...(opts as DesertParallaxOptions), layer: 'near' }) },
  finishBanner: { kind: 'svg', generate: (opts) => finishBannerSvg(opts as FinishBannerOptions) },
  'dune.floor': { kind: 'svg', generate: (opts) => duneFloorSvg(opts as DuneFloorOptions) },
  'dune.wall': { kind: 'svg', generate: (opts) => duneWallSvg(opts as DuneWallOptions) },
  'dune.quicksand': { kind: 'svg', generate: (opts) => quicksandSvg(opts as QuicksandOptions) },
  'dune.trap': { kind: 'svg', generate: (opts) => trapSvg(opts as TrapOptions) },
  'dune.exit': { kind: 'svg', generate: (opts) => exitSvg(opts as ExitOptions) },
  'dune.artifact': { kind: 'svg', generate: (opts) => artifactSvg(opts as ArtifactOptions) },
  'dune.breadcrumb': { kind: 'svg', generate: (opts) => breadcrumbSvg(opts as BreadcrumbOptions) },
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

/** Returns the clan-specific camel key if registered, else the generic placeholder. */
export function resolveCamelKey(clanName: string): string {
  const key = `camel.${clanAssetSlug(clanName)}`;
  return key in ASSETS ? key : 'camel';
}

/** Returns the clan+form-specific card key if registered, else the generic card frame. */
export function resolveCardKey(clanName: string, formNumber: number): string {
  const key = `card.${clanAssetSlug(clanName)}.${formNumber}`;
  return key in ASSETS ? key : 'card.frame';
}
