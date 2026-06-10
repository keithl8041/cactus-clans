/// <reference types="@cloudflare/workers-types" />

// Re-exported directly so wrangler's class lookup finds it without esbuild
// tree-shaking the symbol away (it does that when the only other reference
// is in a type position).
export { MatchLobby } from './lobby';

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MATCH_LOBBY: DurableObjectNamespace;
}

interface PlayerRow {
  id: string;
  nickname: string;
}

interface LeaderboardRow {
  nickname: string;
  clan: string;
  totalScore: number;
  completedAt: string | null;
  currentLevel: number | null;
}

interface TeamLeaderboardRow {
  teamLabel: string;
  score: number;
  recordedAt: string | null;
}

const COMING_SOON_HOSTS = new Set(['www.cactusclans.co.uk', 'cactusclans.co.uk']);
// Midnight 13 June 2026, UK time (BST = UTC+1). After this instant the
// coming-soon gate falls away and the SPA is served on www/apex normally.
const COMING_SOON_LAUNCH_AT_MS = Date.parse('2026-06-13T00:00:00+01:00');
// Paths the splash page itself needs to render; everything else on the gated
// host is replaced with the coming-soon HTML.
const COMING_SOON_ALLOWED_PATHS = new Set(['/logo.png', '/favicon.ico']);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // Belt-and-braces HTTPS. Cloudflare's edge already upgrades workers.dev
    // HTTP requests, but on custom domains the rule isn't guaranteed. A 301
    // here + HSTS on every response makes mixed-content / WS-scheme bugs
    // impossible from this side, regardless of the route.
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return new Response(null, {
        status: 301,
        headers: {
          location: url.toString(),
          'strict-transport-security': 'max-age=63072000; includeSubDomains',
        },
      });
    }
    // The gate hides the SPA on www/apex pre-launch, but must not swallow the
    // API: /api/* always falls through to route() so the (cached) game shell on
    // any host still gets JSON back instead of the coming-soon HTML.
    if (
      COMING_SOON_HOSTS.has(url.hostname) &&
      Date.now() < COMING_SOON_LAUNCH_AT_MS &&
      !url.pathname.startsWith('/api/')
    ) {
      if (COMING_SOON_ALLOWED_PATHS.has(url.pathname)) {
        return withHsts(await env.ASSETS.fetch(request));
      }
      return withHsts(comingSoonResponse());
    }
    if (!url.pathname.startsWith('/api/')) {
      const assetRes = await env.ASSETS.fetch(request);
      return withHsts(assetRes);
    }
    try {
      const res = await route(url, request, env, ctx);
      return withHsts(res ?? json({ error: 'not found' }, 404));
    } catch (err) {
      return withHsts(json({ error: err instanceof Error ? err.message : String(err) }, 500));
    }
  },
};

function withHsts(res: Response): Response {
  // WS 101 upgrades can't be cloned; pass them through untouched.
  if (res.status === 101) return res;
  const headers = new Headers(res.headers);
  if (!headers.has('strict-transport-security')) {
    headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function route(
  url: URL,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response | null> {
  const { pathname } = url;
  const method = request.method;

  // Versus mode: per-lobby WebSocket → Durable Object. Lobby code from the URL
  // keys the DO instance, so any two clients that visit /versus/<same code>
  // converge on the same in-memory game.
  const versusMatch = pathname.match(/^\/api\/versus\/([A-Za-z0-9-]{1,32})\/ws$/);
  if (versusMatch) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return json({ error: 'expected websocket upgrade' }, 426);
    }
    const code = versusMatch[1].toUpperCase();
    const stub = env.MATCH_LOBBY.get(env.MATCH_LOBBY.idFromName(code));
    return stub.fetch(request);
  }

  if (pathname === '/api/players/check' && method === 'GET') {
    const nickname = (url.searchParams.get('nickname') ?? '').trim();
    if (!nickname) return json({ error: 'nickname required' }, 400);
    if (nickname.length > 24) return json({ error: 'nickname too long' }, 400);

    const existing = await env.DB
      .prepare('SELECT 1 AS hit FROM players WHERE nickname = ?')
      .bind(nickname)
      .first<{ hit: number }>();
    if (!existing) return json({ exists: false, suggestions: [] });

    const candidates = generateNicknameCandidates(nickname, 12);
    if (candidates.length === 0) return json({ exists: true, suggestions: [] });
    const placeholders = candidates.map(() => '?').join(',');
    const takenRows = await env.DB
      .prepare(`SELECT nickname FROM players WHERE nickname IN (${placeholders})`)
      .bind(...candidates)
      .all<{ nickname: string }>();
    const taken = new Set((takenRows.results ?? []).map((r) => r.nickname));
    const suggestions = candidates.filter((c) => !taken.has(c)).slice(0, 3);
    return json({ exists: true, suggestions });
  }

  if (pathname === '/api/players' && method === 'POST') {
    const { nickname, pin } = await readJson<{ nickname?: string; pin?: string }>(request);
    const cleaned = (nickname ?? '').trim();
    if (!cleaned) return json({ error: 'nickname required' }, 400);
    if (cleaned.length > 24) return json({ error: 'nickname too long' }, 400);
    if (!pin || !/^\d{4}$/.test(pin)) return json({ error: 'pin must be 4 digits' }, 400);

    const existing = await env.DB.prepare(
      'SELECT id, nickname, pin_hash AS pinHash FROM players WHERE nickname = ?',
    )
      .bind(cleaned)
      .first<PlayerRow & { pinHash: string }>();
    if (existing) {
      const ok = await verifyPin(pin, existing.pinHash);
      if (!ok) return json({ error: 'wrong_pin' }, 401);
      return json({ id: existing.id, nickname: existing.nickname });
    }

    const id = crypto.randomUUID();
    const pinHash = await hashPin(pin);
    await env.DB.prepare('INSERT INTO players (id, nickname, pin_hash) VALUES (?, ?, ?)')
      .bind(id, cleaned, pinHash)
      .run();
    return json({ id, nickname: cleaned });
  }

  const activeRunMatch = pathname.match(/^\/api\/players\/([^/]+)\/active-run$/);
  if (activeRunMatch && method === 'GET') {
    const playerId = activeRunMatch[1];
    // Resume rule: prefer the latest in-progress run; if none, fall back to the
    // most recent run (completed or abandoned) so signing in on a fresh device
    // (or after a completed run) drops the player back on the level map with
    // their journey state instead of the new-starter clan-select flow.
    const run = await env.DB
      .prepare(
        `SELECT id, player_id AS playerId, clan, started_at AS startedAt,
                total_score AS totalScore, completed_at AS completedAt
         FROM runs
         WHERE player_id = ?
         ORDER BY (completed_at IS NULL) DESC, started_at DESC
         LIMIT 1`,
      )
      .bind(playerId)
      .first<{ id: string; playerId: string; clan: string; startedAt: string; totalScore: number; completedAt: string | null }>();
    if (!run) return json({ run: null });

    // One row per (run_id, level_number) — UPSERT on write keeps the best attempt
    // (sticky pass + higher score), so reads no longer need a ROW_NUMBER() dedup.
    // WHERE run_id seeks the UNIQUE(run_id, level_number) index.
    const levelRows = await env.DB
      .prepare(
        `SELECT level_number AS levelNumber, passed, mini_game_points AS miniGamePoints,
                elapsed_ms AS elapsedMs, score, recorded_at AS recordedAt
         FROM level_results
         WHERE run_id = ?
         ORDER BY level_number ASC`,
      )
      .bind(run.id)
      .all<{
        levelNumber: number;
        passed: number;
        miniGamePoints: number;
        elapsedMs: number;
        score: number;
        recordedAt: string;
      }>();
    const levels = (levelRows.results ?? []).map((r) => ({
      levelNumber: r.levelNumber,
      passed: r.passed === 1,
      miniGamePoints: r.miniGamePoints,
      elapsedMs: r.elapsedMs,
      score: r.score,
      recordedAt: r.recordedAt,
    }));
    const totalScore = levels.reduce((acc, l) => acc + l.score, 0);
    return json({
      run: {
        runId: run.id,
        playerId: run.playerId,
        clan: run.clan,
        startedAt: run.startedAt,
        completedAt: run.completedAt ?? undefined,
        totalScore,
        levels,
      },
    });
  }

  if (pathname === '/api/runs' && method === 'POST') {
    const { playerId, clan } = await readJson<{ playerId?: string; clan?: string }>(request);
    if (!playerId || !clan) return json({ error: 'playerId + clan required' }, 400);
    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO runs (id, player_id, clan, started_at, total_score) VALUES (?, ?, ?, ?, 0)',
    )
      .bind(id, playerId, clan, startedAt)
      .run();
    return json({ id, startedAt });
  }

  const levelsMatch = pathname.match(/^\/api\/runs\/([^/]+)\/levels$/);
  if (levelsMatch && method === 'POST') {
    const runId = levelsMatch[1];
    const body = await readJson<{
      levelNumber: number;
      passed: boolean;
      miniGamePoints: number;
      elapsedMs: number;
      score: number;
      totalScore: number;
    }>(request);
    await env.DB.batch([
      // UPSERT one row per (run_id, level_number). The ON CONFLICT WHERE clause
      // mirrors pickBetterLevel in src/services/progress.ts: a pass is sticky (a
      // later fail can't overwrite it) and otherwise the higher score wins. When
      // the incoming attempt doesn't win, the WHERE filters out the update (no-op).
      env.DB
        .prepare(
          `INSERT INTO level_results
             (id, run_id, level_number, passed, mini_game_points, elapsed_ms, score)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(run_id, level_number) DO UPDATE SET
             passed = excluded.passed,
             mini_game_points = excluded.mini_game_points,
             elapsed_ms = excluded.elapsed_ms,
             score = excluded.score,
             recorded_at = excluded.recorded_at
           WHERE NOT (level_results.passed = 1 AND excluded.passed = 0)
             AND ((level_results.passed = 0 AND excluded.passed = 1)
                  OR excluded.score > level_results.score)`,
        )
        .bind(
          crypto.randomUUID(),
          runId,
          body.levelNumber,
          body.passed ? 1 : 0,
          body.miniGamePoints,
          body.elapsedMs,
          body.score,
        ),
      env.DB
        .prepare('UPDATE runs SET total_score = ?, current_level = MAX(current_level, ?) WHERE id = ?')
        .bind(body.totalScore, body.levelNumber, runId),
    ]);
    return json({ ok: true });
  }

  const completeMatch = pathname.match(/^\/api\/runs\/([^/]+)\/complete$/);
  if (completeMatch && method === 'POST') {
    const runId = completeMatch[1];
    const { totalScore } = await readJson<{ totalScore: number }>(request);
    const completedAt = new Date().toISOString();
    await env.DB
      .prepare('UPDATE runs SET completed_at = ?, total_score = ? WHERE id = ?')
      .bind(completedAt, totalScore, runId)
      .run();
    return json({ completedAt });
  }

  if (pathname === '/api/leaderboard' && method === 'GET') {
    return withEdgeCache(url, ctx, async () => {
      const requested = Number(url.searchParams.get('limit') ?? '50') || 50;
      const limit = Math.min(Math.max(requested, 1), 200);
      // One row per player — their highest-scoring run (in-progress runs still
      // count so kids see effort tracked). Ties broken by most recent completion.
      // current_level is read straight off runs (denormalized), so the board
      // never touches level_results. The window scans runs in player/score order
      // via runs_player_score_idx.
      const result = await env.DB
        .prepare(
          `WITH ranked AS (
             SELECT r.id AS run_id, r.player_id, r.clan, r.total_score, r.completed_at,
                    r.current_level,
                    ROW_NUMBER() OVER (
                      PARTITION BY r.player_id
                      ORDER BY r.total_score DESC, r.completed_at DESC
                    ) AS rn
             FROM runs r
           )
           SELECT p.nickname, ranked.clan, ranked.total_score AS totalScore,
                  ranked.completed_at AS completedAt,
                  CASE
                    WHEN ranked.completed_at IS NULL THEN ranked.current_level
                    ELSE NULL
                  END AS currentLevel
           FROM ranked
           INNER JOIN players p ON p.id = ranked.player_id
           WHERE ranked.rn = 1
           ORDER BY totalScore DESC
           LIMIT ?`,
        )
        .bind(limit)
        .all<LeaderboardRow>();
      return json(result.results ?? []);
    });
  }

  if (pathname === '/api/team-leaderboard' && method === 'GET') {
    return withEdgeCache(url, ctx, async () => {
      const requested = Number(url.searchParams.get('limit') ?? '50') || 50;
      const limit = Math.min(Math.max(requested, 1), 200);
      // One row per team (a sorted nickname pair) — their best co-op round.
      // Mirrors the solo board: ties broken by most recent. team_scores is only
      // written for genuine two-player rounds, so practise runs never appear.
      const result = await env.DB
        .prepare(
          `WITH ranked AS (
             SELECT team_label, score, recorded_at,
                    ROW_NUMBER() OVER (
                      PARTITION BY team_key
                      ORDER BY score DESC, recorded_at DESC
                    ) AS rn
             FROM team_scores
           )
           SELECT team_label AS teamLabel, score, recorded_at AS recordedAt
           FROM ranked
           WHERE rn = 1
           ORDER BY score DESC
           LIMIT ?`,
        )
        .bind(limit)
        .all<TeamLeaderboardRow>();
      return json(result.results ?? []);
    });
  }

  if (pathname === '/api/demo-leaderboard' && method === 'GET') {
    return withEdgeCache(url, ctx, async () => {
      const requested = Number(url.searchParams.get('limit') ?? '50') || 50;
      const limit = Math.min(Math.max(requested, 1), 200);
      const eventContext = url.searchParams.get('context') ?? 'jkps-summer-fair';
      // One row per nickname — their highest score for this event context.
      const result = await env.DB
        .prepare(
          `SELECT nickname, MAX(score) AS score
           FROM demo_scores
           WHERE context = ?
           GROUP BY nickname
           ORDER BY score DESC
           LIMIT ?`,
        )
        .bind(eventContext, limit)
        .all<{ nickname: string; score: number }>();
      return json(result.results ?? []);
    });
  }

  if (pathname === '/api/demo-scores' && method === 'POST') {
    const body = await readJson<{ nickname?: string; score?: number; context?: string }>(request);
    if (!body.nickname || typeof body.score !== 'number') {
      return json({ error: 'nickname and score required' }, 400);
    }
    const id = crypto.randomUUID();
    const eventContext = (body.context ?? 'jkps-summer-fair').slice(0, 64);
    await env.DB
      .prepare('INSERT INTO demo_scores (id, nickname, score, context) VALUES (?, ?, ?, ?)')
      .bind(id, body.nickname.slice(0, 24), Math.round(body.score), eventContext)
      .run();
    return json({ ok: true });
  }

  return null;
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const LEADERBOARD_CACHE_TTL_S = 30;

/**
 * Edge-cache a read-only JSON endpoint for a short TTL. The leaderboards are
 * read-heavy and tolerate a few seconds of staleness (family game), so this
 * collapses repeated loads to near-zero D1 work. The cache key is the full URL
 * (the `limit` param lives there), so different limits cache independently. No
 * explicit invalidation — the short TTL handles it.
 */
async function withEdgeCache(
  url: URL,
  ctx: ExecutionContext,
  build: () => Promise<Response>,
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  const res = await build();
  // Only cache successful responses, and attach a TTL the Cache API honours.
  if (res.status === 200) {
    const headers = new Headers(res.headers);
    headers.set('cache-control', `public, max-age=${LEADERBOARD_CACHE_TTL_S}`);
    const cacheable = new Response(res.body, { status: res.status, headers });
    ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
    return cacheable;
  }
  return res;
}

function comingSoonResponse(): Response {
  return new Response(COMING_SOON_HTML, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Don't let CDNs/browsers pin the splash past the cutover.
      'cache-control': 'public, max-age=60, must-revalidate',
    },
  });
}

const COMING_SOON_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Cactus Clans — Coming Soon</title>
<meta name="description" content="Cactus Clans launches 13 June 2026." />
<meta name="robots" content="noindex" />
<link rel="icon" href="/favicon.ico" />
<style>
  :root {
    --sand: #f4dca0;
    --sand-deep: #e2b863;
    --sky: #fbe6b3;
    --ink: #3a2415;
    --cactus: #2f7a4a;
    --cactus-dark: #1f5132;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; min-height: 100%; }
  body {
    font-family: ui-rounded, "Nunito", "Quicksand", system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--ink);
    background: radial-gradient(ellipse at top, var(--sky) 0%, var(--sand) 55%, var(--sand-deep) 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 20px;
    text-align: center;
  }
  .card {
    max-width: 560px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }
  .logo {
    width: min(70vw, 320px);
    height: auto;
    border-radius: 24px;
    box-shadow: 0 14px 40px rgba(58, 36, 21, 0.25);
  }
  h1 {
    margin: 0;
    font-size: clamp(1.8rem, 6vw, 2.6rem);
    letter-spacing: 0.5px;
    color: var(--cactus-dark);
  }
  p.tagline {
    margin: 0;
    font-size: clamp(1rem, 3.2vw, 1.15rem);
    line-height: 1.5;
    color: var(--ink);
    opacity: 0.85;
  }
  .countdown {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 4px;
  }
  .unit {
    background: rgba(255, 255, 255, 0.55);
    border: 2px solid var(--cactus);
    border-radius: 14px;
    padding: 10px 14px;
    min-width: 72px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 4px 14px rgba(58, 36, 21, 0.12);
  }
  .unit .num {
    font-size: clamp(1.6rem, 5vw, 2.1rem);
    font-weight: 800;
    color: var(--cactus-dark);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .unit .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 6px;
    color: var(--ink);
    opacity: 0.7;
  }
  .launch {
    font-size: 0.95rem;
    opacity: 0.7;
    margin-top: 4px;
  }
  footer {
    margin-top: 8px;
    font-size: 0.85rem;
    opacity: 0.6;
  }
  @media (prefers-reduced-motion: no-preference) {
    .logo { transition: transform 200ms ease; }
    .logo:hover { transform: rotate(-1deg) scale(1.02); }
  }
</style>
</head>
<body>
  <main class="card">
    <img class="logo" src="/logo.png" alt="Cactus Clans" />
    <h1>Coming Soon</h1>
    <p class="tagline">The Cactus Clans are gathering. Sharpen your spikes — the desert opens 13 June 2026.</p>
    <div class="countdown" id="countdown" aria-live="polite">
      <div class="unit"><span class="num" id="d">--</span><span class="label">Days</span></div>
      <div class="unit"><span class="num" id="h">--</span><span class="label">Hours</span></div>
      <div class="unit"><span class="num" id="m">--</span><span class="label">Minutes</span></div>
      <div class="unit"><span class="num" id="s">--</span><span class="label">Seconds</span></div>
    </div>
    <p class="launch">Launching 13 June 2026</p>
    <footer>cactusclans.co.uk</footer>
  </main>
<script>
  (function () {
    var target = Date.parse('2026-06-13T00:00:00+01:00');
    var d = document.getElementById('d');
    var h = document.getElementById('h');
    var m = document.getElementById('m');
    var s = document.getElementById('s');
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function tick() {
      var diff = target - Date.now();
      if (diff <= 0) {
        d.textContent = '00'; h.textContent = '00'; m.textContent = '00'; s.textContent = '00';
        // Reload so the now-elapsed worker gate falls through to the real app.
        setTimeout(function () { location.reload(); }, 1500);
        return;
      }
      var secs = Math.floor(diff / 1000);
      var days = Math.floor(secs / 86400); secs -= days * 86400;
      var hrs = Math.floor(secs / 3600); secs -= hrs * 3600;
      var mins = Math.floor(secs / 60); secs -= mins * 60;
      d.textContent = pad(days);
      h.textContent = pad(hrs);
      m.textContent = pad(mins);
      s.textContent = pad(secs);
    }
    tick();
    setInterval(tick, 1000);
  })();
</script>
</body>
</html>`;

const PIN_ITERATIONS = 100_000;
const PIN_SALT_BYTES = 16;
const PIN_KEY_BITS = 256;

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PIN_SALT_BYTES));
  const hash = await derivePinBits(pin, salt, PIN_ITERATIONS);
  return `pbkdf2$${PIN_ITERATIONS}$${b64encode(salt)}$${b64encode(hash)}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  const salt = b64decode(parts[2]);
  const expected = b64decode(parts[3]);
  const actual = new Uint8Array(await derivePinBits(pin, salt, iterations));
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

async function derivePinBits(pin: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    PIN_KEY_BITS,
  );
}

function b64encode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function generateNicknameCandidates(nickname: string, count: number): string[] {
  const base = nickname.length > 22 ? nickname.slice(0, 22) : nickname;
  const out = new Set<string>();
  let attempts = 0;
  while (out.size < count && attempts < 40) {
    attempts++;
    const n = Math.floor(Math.random() * 100);
    out.add(`${base}${n}`);
  }
  return [...out];
}
