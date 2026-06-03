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
import { breadcrumbSvg, type BreadcrumbOptions } from './placeholders/breadcrumb';
import { camelSvg, type CamelOptions } from './placeholders/camel';
import { clanCardSvg, type ClanCardOptions } from './placeholders/clanCard';
import { characterSvg, type CharacterOptions } from './placeholders/character';
import type { DartboardOptions } from './placeholders/dartboard';
import type { DesertParallaxOptions } from './placeholders/desertParallax';
import type { FinishBannerOptions } from './placeholders/finishBanner';
import { hitSplatSvg, type HitSplatOptions } from './placeholders/hitSplat';
import { lizardSvg, type LizardOptions } from './placeholders/lizard';
import { petCactusSvg, type PetCactusOptions } from './placeholders/petCactus';
import { potSvg, type PotOptions } from './placeholders/pot';
import { rainOverlaySvg, type RainOverlayOptions } from './placeholders/rainOverlay';
import type { RockOptions } from './placeholders/rock';
import type { SliceableCactusOptions } from './placeholders/sliceableCactus';
import { starSvg, type StarOptions } from './placeholders/star';
import { sunOverlaySvg, type SunOverlayOptions } from './placeholders/sunOverlay';
import type { TarantulaOptions } from './placeholders/tarantula';
import type { WaterFlaskOptions } from './placeholders/waterFlask';
import { wateringCanSvg, type WateringCanOptions } from './placeholders/wateringCan';

export type AssetOptions =
  | BalloonOptions
  | BreadcrumbOptions
  | CamelOptions
  | ClanCardOptions
  | CharacterOptions
  | DartboardOptions
  | DesertParallaxOptions
  | FinishBannerOptions
  | HitSplatOptions
  | LizardOptions
  | PetCactusOptions
  | PotOptions
  | RainOverlayOptions
  | RockOptions
  | SliceableCactusOptions
  | StarOptions
  | SunOverlayOptions
  | TarantulaOptions
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
  'cactus.spike.game2': { kind: 'image', src: '/art/cactus-spike-game2.png' },
  'cactus.spike.game6': { kind: 'image', src: '/art/game6-cactus-dart.png' },
  'camel.prickling': { kind: 'image', src: '/art/camel-prickling-clan.png' },
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
  'game2.floor': { kind: 'image', src: '/art/game2-floor.png' },
  'game3.background': { kind: 'image', src: '/art/game3-background.png' },
  'game3.pot': { kind: 'image', src: '/art/game3-pot.png' },
  'game3.lizard.green': { kind: 'image', src: '/art/game3-lizard-green.png' },
  'game3.lizard.dark-green': { kind: 'image', src: '/art/game3-lizard-dark-green.png' },
  'game3.lizard.gold': { kind: 'image', src: '/art/game3-lizard-gold.png' },
  'game3.hit-splat': { kind: 'image', src: '/art/game3-hit-splat.png' },
  'game4.background': { kind: 'image', src: '/art/game4-background.png' },
  'game4.background.rain': { kind: 'image', src: '/art/game4-background-rain.png' },
  'game4.background.sun': { kind: 'image', src: '/art/game4-background-sun.png' },
  'game4.watering-can': { kind: 'image', src: '/art/game4-watering-can.png' },
  'game4.water-droplet': { kind: 'image', src: '/art/game4-water-droplet.png' },
  'game4.thirst-gauge': { kind: 'image', src: '/art/game4-thirst-gauge.png' },
  'game5.background': { kind: 'image', src: '/art/game5-background.png' },
  'game6.background': { kind: 'image', src: '/art/game6-background.png' },
  'cactus.pet.prickling.happy': { kind: 'image', src: '/art/cactus-pet-prickling-clan.png' },
  'cactus.pet.prickling.sad': { kind: 'image', src: '/art/cactus-pet-prickling-clan-drenched-wilted.png' },
  dartboard: { kind: 'image', src: '/art/game6-dartboard.png' },
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
  'cactus.whole': { kind: 'image', src: '/art/game5-cactus-whole.png' },
  'cactus.half.left': { kind: 'image', src: '/art/game5-cactus-half-left.png' },
  'cactus.half.right': { kind: 'image', src: '/art/game5-cactus-half-right.png' },
  pot: { kind: 'svg', generate: (opts) => potSvg(opts as PotOptions) },
  rainOverlay: { kind: 'svg', generate: (opts) => rainOverlaySvg(opts as RainOverlayOptions) },
  star: { kind: 'svg', generate: (opts) => starSvg(opts as StarOptions) },
  sunOverlay: { kind: 'svg', generate: (opts) => sunOverlaySvg(opts as SunOverlayOptions) },
  tarantula: { kind: 'image', src: '/art/tarantula.png' },
  camel: { kind: 'svg', generate: (opts) => camelSvg(opts as CamelOptions) },
  rock: { kind: 'image', src: '/art/rock.png' },
  waterFlask: { kind: 'image', src: '/art/water-flask.png' },
  'desert.parallax.far': { kind: 'image', src: '/art/desert-parallax-far.png' },
  'desert.parallax.mid': { kind: 'image', src: '/art/desert-parallax-mid.png' },
  'desert.parallax.near': { kind: 'image', src: '/art/desert-parallax-near.png' },
  finishBanner: { kind: 'image', src: '/art/finish-banner.png' },
  'dune.floor': { kind: 'image', src: '/art/game7-floor.png' },
  'dune.wall': { kind: 'image', src: '/art/game7-wall.png' },
  'dune.quicksand': { kind: 'image', src: '/art/game7-quicksand.png' },
  'dune.trap': { kind: 'image', src: '/art/game7-trap.png' },
  'dune.exit': { kind: 'image', src: '/art/game7-exit.png' },
  'dune.artifact.1': { kind: 'image', src: '/art/game7-artifact-1.png' },
  'dune.artifact.2': { kind: 'image', src: '/art/game7-artifact-2.png' },
  'dune.artifact.3': { kind: 'image', src: '/art/game7-artifact-3.png' },
  'dune.breadcrumb': { kind: 'svg', generate: (opts) => breadcrumbSvg(opts as BreadcrumbOptions) },
  'dune.compass': { kind: 'image', src: '/art/game7-compass.svg' },
  // Desert Dash (level 8). Dedicated parallax/star keys — do NOT reuse the
  // shared `desert.parallax.*` (Camel Race) or `star` (Balloon) keys.
  'game8.parallax.far': { kind: 'image', src: '/art/game8-parallax-far.png' },
  'game8.parallax.mid': { kind: 'image', src: '/art/game8-parallax-mid.png' },
  'game8.parallax.near': { kind: 'image', src: '/art/game8-parallax-near.png' },
  'game8.floor': { kind: 'image', src: '/art/game8-floor.png' },
  'game8.star': { kind: 'image', src: '/art/game8-star.svg' },
  'game8.jumpButton': { kind: 'image', src: '/art/game8-button-jump.png' },
  'game8.bossHealthBar': { kind: 'image', src: '/art/game8-boss-health-bar.svg' },
  'game8.prop.a': { kind: 'image', src: '/art/game8-cactus-prop-a.png' },
  'game8.prop.b': { kind: 'image', src: '/art/game8-cactus-prop-b.png' },
  'game8.prop.c': { kind: 'image', src: '/art/game8-cactus-prop-c.png' },
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

/** Returns the clan-specific pet cactus key for a given mood, else falls back to the procedural placeholder. */
export function resolvePetCactusKey(clanName: string, mood: 'happy' | 'sad'): string {
  const key = `cactus.pet.${clanAssetSlug(clanName)}.${mood}`;
  return key in ASSETS ? key : 'cactus.pet';
}
