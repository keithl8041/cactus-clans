# Cactus Clans — Online Companion

The online companion to the **Cactus Clans** physical trading card game. Pick a clan, start as the youngest sprout (form 1), clear a mini-game at each of 8 levels to evolve into your clan's boss, and race the leaderboard.

## Tech stack

- **Vite + TypeScript + React 18** for the build, dev server, and shell UI (splash, nickname, clan select, level map, leaderboard, game container)
- **Phaser 3** with Arcade Physics for the in-level mini-games
- **Zustand** for cross-screen state (player, run, progress)
- **Supabase** (optional) for player accounts and the public leaderboard — when not configured, the app falls back to a localStorage-only mock so dev still works end-to-end
- Procedural **SVG placeholders** behind a central asset manifest so real art can be dropped in one line at a time

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173 (also exposed on the LAN for phone testing)
npm run typecheck    # strict TS
npm run build        # production build → dist/
npm run preview      # serve the built bundle
npm run parse-cards  # regenerate src/data/cards.json from _docs/CactusClan_trading.xlsx
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
    supabase.ts              Client singleton, null when env unset
    session.ts               Nickname-based "auth" (no real credentials)
    progress.ts              Run + level result persistence
    leaderboard.ts           Global leaderboard queries
  store/gameStore.ts         Zustand store
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

## Supabase setup (optional)

If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are unset, the app uses localStorage and the leaderboard is local-only. To wire up real shared persistence:

1. Create a new project at https://supabase.com.
2. In the SQL editor, run:

   ```sql
   create extension if not exists "pgcrypto";

   create table players (
     id uuid primary key default gen_random_uuid(),
     nickname text unique not null,
     created_at timestamptz default now()
   );

   create table runs (
     id uuid primary key default gen_random_uuid(),
     player_id uuid references players(id) on delete cascade,
     clan text not null,
     started_at timestamptz default now(),
     completed_at timestamptz,
     total_score int default 0
   );

   create table level_results (
     id uuid primary key default gen_random_uuid(),
     run_id uuid references runs(id) on delete cascade,
     level_number int not null,
     passed bool not null,
     mini_game_points int not null,
     elapsed_ms int not null,
     score int not null,
     recorded_at timestamptz default now()
   );

   -- Open RLS for the no-real-auth model. Tighten later if needed.
   alter table players enable row level security;
   alter table runs enable row level security;
   alter table level_results enable row level security;
   create policy "anyone reads players" on players for select using (true);
   create policy "anyone inserts players" on players for insert with check (true);
   create policy "anyone reads runs" on runs for select using (true);
   create policy "anyone writes runs" on runs for all using (true) with check (true);
   create policy "anyone reads level_results" on level_results for select using (true);
   create policy "anyone writes level_results" on level_results for all using (true) with check (true);
   ```

3. Copy `.env.example` to `.env` and fill in your project URL + anon key.
4. Restart `npm run dev`.

> The "anyone writes" policy is a known trade-off for the nickname-only model. Sticky-fingered kids can spoof scores. That's fine for a family game; switch to magic-link auth + RLS-by-`auth.uid()` if it ever matters.

## Deploy to Cloudflare Pages

The app is a static SPA — Cloudflare Pages serves it directly.

1. Push the repo to GitHub.
2. In the Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Choose the repo. Build settings:
   - **Framework preset**: *None*
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node version**: 20 (set via `NODE_VERSION=20` environment variable)
4. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` if you want the shared leaderboard.
5. Save and deploy. Subsequent pushes to `main` auto-deploy.

Because the app uses client-side routing, add a `_redirects` file so deep links work:

```bash
echo "/* /index.html 200" > public/_redirects
```

This is already included in the project.
