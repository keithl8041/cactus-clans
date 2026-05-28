/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
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
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }
    try {
      const res = await route(url, request, env);
      return res ?? json({ error: 'not found' }, 404);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  },
};

async function route(url: URL, request: Request, env: Env): Promise<Response | null> {
  const { pathname } = url;
  const method = request.method;

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
      env.DB
        .prepare(
          'INSERT INTO level_results (id, run_id, level_number, passed, mini_game_points, elapsed_ms, score) VALUES (?, ?, ?, ?, ?, ?, ?)',
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
        .prepare('UPDATE runs SET total_score = ? WHERE id = ?')
        .bind(body.totalScore, runId),
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
    const requested = Number(url.searchParams.get('limit') ?? '50') || 50;
    const limit = Math.min(Math.max(requested, 1), 200);
    // One row per player — their highest-scoring run (in-progress runs still
    // count so kids see effort tracked). Ties broken by most recent completion.
    const result = await env.DB
      .prepare(
        `WITH ranked AS (
           SELECT r.player_id, r.clan, r.total_score, r.completed_at,
                  ROW_NUMBER() OVER (
                    PARTITION BY r.player_id
                    ORDER BY r.total_score DESC, r.completed_at DESC
                  ) AS rn
           FROM runs r
         )
         SELECT p.nickname, ranked.clan, ranked.total_score AS totalScore,
                ranked.completed_at AS completedAt
         FROM ranked
         INNER JOIN players p ON p.id = ranked.player_id
         WHERE ranked.rn = 1
         ORDER BY totalScore DESC
         LIMIT ?`,
      )
      .bind(limit)
      .all<LeaderboardRow>();
    return json(result.results ?? []);
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
