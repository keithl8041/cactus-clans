# Cactus Clans — Online Companion

The online companion to the **Cactus Clans** physical trading card game. Pick a clan, start as the youngest sprout (form 1), clear a mini-game at each of 8 levels to evolve into your clan's boss, and race the leaderboard.

## Tech stack

- **Vite + TypeScript + React 18** for the build, dev server, and shell UI (splash, nickname, clan select, level map, leaderboard, game container)
- **Phaser 3** with Arcade Physics for the in-level mini-games
- **Zustand** for cross-screen state (player, run, progress)
- **Cloudflare Worker + D1** for player accounts and the public leaderboard — when running `vite dev` (no Worker), the app falls back to a localStorage-only mock so dev still works end-to-end
- Procedural **SVG placeholders** behind a central asset manifest so real art can be dropped in one line at a time

## Run locally

```bash
npm install
npm run dev            # http://localhost:5173 (also exposed on the LAN for phone testing)
npm run typecheck      # strict TS — runs against both client (src/) and worker/
npm run build          # production build → dist/
npm run preview        # serve the built bundle
npm run parse-cards    # regenerate src/data/cards.json from _docs/CactusClan_trading.xlsx
npm run worker:dev     # run the Cloudflare Worker locally with a local D1
npm run worker:deploy  # build + `wrangler deploy` (Worker + static assets together)
```

The dev server binds to `0.0.0.0` so you can play on a phone over the LAN — open the `Network:` URL Vite prints when it starts.

## Project layout

```
src/
  shell/                     React screens — splash, nickname, clan select, level map, leaderboard, GameContainer
  levels/
    types.ts                 LevelDefinition contract — the plugin shape every level implements
    meta.ts                  Lightweight level metadata, safe to import from the shell (no Phaser)
    registry.ts              Full registry with Phaser scene factories (imported lazily)
    01-balloon-keepy-uppy/   Level 1
  assets/
    manifest.ts              Central asset registry (SVG today, PNGs later — one-line swap)
    placeholders/*.ts        Procedural SVG generators for placeholders
    loader.ts                Phaser preload helper that resolves manifest keys
  data/
    cards.json               Generated from the spreadsheet
    cards.ts, clans.ts       Typed data accessors
  services/
    api.ts                   /api fetch helper + usingRealBackend flag
    session.ts               Nickname-based "auth" (no real credentials)
    progress.ts              Run + level result persistence
    leaderboard.ts           Global leaderboard queries
  store/gameStore.ts         Zustand store
worker/
  index.ts                   Cloudflare Worker handling /api/*, falls through to static assets
  schema.sql                 D1 schema (players, runs, level_results)
  tsconfig.json              Workers-types typecheck for the Worker
scripts/
  parse-cards.mjs            One-shot xlsx → JSON converter (no runtime dep)
_docs/CactusClan_trading.xlsx  Source of truth for card data
```

Phaser is loaded lazily — it only ships to the browser once the player opens a level, keeping the initial page small.

## Adding a new level

1. Create `src/levels/02-something/` with `index.ts`, `MyScene.ts`, and `config.ts`.
2. Implement a `Phaser.Scene` whose constructor takes a `LevelContext`. Call `ctx.onComplete({...})` when the player passes or fails.
3. Export a `LevelDefinition` from `index.ts`.
4. Append it to `LEVELS` in `src/levels/registry.ts`.
5. Add a matching `LevelMeta` entry to `src/levels/meta.ts` (so the level map UI renders it without pulling Phaser into the main bundle).

No shell code changes needed.

## Swapping a placeholder for real art

In `src/assets/manifest.ts`, change a line from:

```ts
balloon: { kind: 'svg', generate: (opts) => balloonSvg(opts as BalloonOptions) },
```

to:

```ts
balloon: { kind: 'png', src: '/art/balloon.png' },
```

Drop the PNG into `public/art/`. That's it.

## Cloudflare D1 setup

The deployed app uses a Cloudflare Worker (`worker/index.ts`) that talks to a D1 database. Local `npm run dev` does **not** run the Worker and falls back to localStorage, so this is only needed once before deploying.

1. Create the D1 database:

   ```bash
   npx wrangler d1 create cactus-clans
   ```

   Copy the `database_id` it prints into `wrangler.jsonc` (replace `REPLACE_WITH_D1_DATABASE_ID`).

2. Apply the schema to the remote D1:

   ```bash
   npm run db:apply
   ```

   (Or `npm run db:apply:local` if you want to exercise `wrangler dev` against a local SQLite-backed D1.)

3. Trust model: the Worker accepts whatever score the client posts — kids can spoof scores from devtools. That's fine for a family game; add a token or recompute server-side if it ever matters.

## Deploy to Cloudflare

The app is deployed as a Worker with static assets — the same Worker that serves `dist/` also handles `/api/*` against D1.

1. One-time: `npm run db:apply` (see above).
2. `npm run worker:deploy` — runs `tsc && vite build`, then `wrangler deploy` (Worker + assets in one shot).

SPA deep-link fallback is configured in `wrangler.jsonc` via `assets.not_found_handling: "single-page-application"`, so any unknown non-`/api` path falls back to `index.html` and the React router handles it.
