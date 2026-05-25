# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server on `0.0.0.0:5173` (LAN-exposed for phone testing). The Worker is NOT running here — services fall back to localStorage.
- `npm run typecheck` — strict TS for both `src/` and `worker/`. There is no test runner, so this is the primary correctness gate before considering a change done.
- `npm run build` — runs `tsc -p tsconfig.json` first, then `vite build`. A type error fails the build.
- `npm run preview` — serve the production bundle from `dist/`.
- `npm run worker:dev` — `wrangler dev`: runs the Worker (with `/api/*` and SPA fallback) against a local D1.
- `npm run worker:deploy` — production build, then `wrangler deploy` (Worker + static assets together).
- `npm run db:apply` / `npm run db:apply:local` — apply `worker/schema.sql` to the remote or local D1.
- `npm run parse-cards` — regenerate `src/data/cards.json` from `_docs/CactusClan_trading.xlsx`. Run this whenever the spreadsheet changes; the JSON is the runtime source of truth and is committed.

## Architecture

### Two-layer split: React shell + Phaser levels

The app is a static SPA with two distinct runtime layers:

- **React shell** (`src/shell/`, `src/App.tsx`) — splash, nickname entry, clan select, level map, leaderboard, and the `GameContainer` route. Wired with `react-router-dom` and Zustand (`src/store/gameStore.ts`).
- **Phaser 3 mini-games** (`src/levels/<NN>-<slug>/`) — each level is a self-contained Phaser scene.

`GameContainer` is **lazy-loaded** via `React.lazy` in `App.tsx`. Phaser only ships to the browser when the player opens a level. **Do not import from `src/levels/registry.ts` or `phaser` from any eagerly-loaded shell module**, or you will pull Phaser into the main bundle.

### Level plugin contract

Every level implements `LevelDefinition` (`src/levels/types.ts`): an id, number (1..8), title/blurb, `passThreshold`, a `buildScene(ctx)` factory returning a `Phaser.Scene`, and a `scoreFor(result)` function. The scene calls `ctx.onComplete({ passed, miniGamePoints, elapsedMs })` (or `ctx.onAbort()`); the shell handles persistence and navigation. Levels never touch the API, routing, or the store directly.

The registry is intentionally split in two:

- `src/levels/meta.ts` — `LEVEL_META`, no Phaser imports. Safe for the shell to consume (e.g. `LevelMap`).
- `src/levels/registry.ts` — `LEVELS`, includes the scene factories. Only imported from `GameContainer` (which is itself lazy).

**Adding a level requires updating BOTH files.** Forgetting `meta.ts` means the level map can't render the entry; forgetting `registry.ts` means `levelByNumber` returns undefined and `GameContainer` redirects back to `/journey`. See README "Adding a new level" for the recipe.

### Asset manifest

All sprites resolve through `src/assets/manifest.ts`. Every entry is either a procedural SVG placeholder (current default) or a PNG path. Swapping placeholders for real art is a one-line change in the manifest — Phaser scenes use `loadAsset(scene, textureKey, manifestKey, opts)` from `src/assets/loader.ts` and React components use `assetUrl(key, opts)`. Don't hard-code asset URLs in scenes or components; add a manifest entry instead.

### Worker+D1-or-localStorage dual mode

`src/services/api.ts` exports `usingRealBackend = !import.meta.env.DEV` plus an `apiFetch` helper that hits `/api/*` on the Cactus Clans Worker (`worker/index.ts`), which is backed by Cloudflare D1. Every service in `src/services/` (`session.ts`, `progress.ts`, `leaderboard.ts`) has **both** an API code path and a localStorage fallback. When adding new persistence, preserve this pattern so `vite dev` still works end-to-end without the Worker running.

Two non-obvious conventions inside this layer:

- **localStorage is the source of truth for the active run** even when the Worker is reachable (`getActiveRun` reads only from localStorage). The API receives writes but isn't read back mid-run — this keeps the UI snappy and survives refreshes.
- "Auth" is nickname-only: `signInWithNickname` upserts a `players` row by unique nickname. The Worker accepts whatever score the client posts (no auth, no signed writes) — a deliberate trade-off for the family-game model. Kids can spoof scores, and that's fine.

### Worker entry / D1

`worker/index.ts` is the single Cloudflare Worker that both serves the SPA (via the `ASSETS` binding) and exposes `/api/*` for D1. The schema lives in `worker/schema.sql` and is applied with `npm run db:apply`. The Worker has its own `worker/tsconfig.json` so the main `tsc -p tsconfig.json` (client) stays DOM-typed while the Worker code typechecks against `@cloudflare/workers-types`. `npm run typecheck` runs both. Don't import anything from `worker/` into `src/`, or vice versa.

### Data flow for a level attempt

1. `LevelMap` reads `LEVEL_META` and the run from the store, navigates to `/play/:levelNumber`.
2. `GameContainer` resolves the `LevelDefinition` from `registry.ts`, builds the scene with a `LevelContext`, mounts a new `Phaser.Game`.
3. Scene fires `ctx.onComplete(result)` → `GameContainer` calls `level.scoreFor(result)`, then `recordLevelResult(run, ...)` (writes localStorage + the Worker API if reachable), updates the store, shows the result overlay.
4. On retry, the result overlay unmounts and the `attempt` counter bumps to force a fresh Phaser instance (the effect tears down the previous `game.destroy(true)` on cleanup).

## Deployment notes

Deploy is `npm run worker:deploy` — `tsc && vite build`, then `wrangler deploy` ships the Worker plus `dist/` together. SPA deep-link fallback is configured in `wrangler.jsonc` via `assets.not_found_handling: "single-page-application"` — **not** via a `_redirects` file (a previous commit removed that approach). If you're tempted to add `public/_redirects`, update `wrangler.jsonc` instead.

Before the first deploy, run `npx wrangler d1 create cactus-clans`, paste the `database_id` into `wrangler.jsonc`, and run `npm run db:apply`.
