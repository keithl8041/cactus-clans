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

  if (pathname === '/api/players' && method === 'POST') {
    const { nickname } = await readJson<{ nickname?: string }>(request);
    const cleaned = (nickname ?? '').trim();
    if (!cleaned) return json({ error: 'nickname required' }, 400);
    if (cleaned.length > 24) return json({ error: 'nickname too long' }, 400);

    const existing = await env.DB.prepare(
      'SELECT id, nickname FROM players WHERE nickname = ?',
    )
      .bind(cleaned)
      .first<PlayerRow>();
    if (existing) return json(existing);

    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO players (id, nickname) VALUES (?, ?)')
      .bind(id, cleaned)
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
    // All runs — including in-progress — ordered by total_score. Failed/partial
    // attempts still show up so kids see their effort tracked.
    const result = await env.DB
      .prepare(
        `SELECT p.nickname, r.clan, r.total_score AS totalScore, r.completed_at AS completedAt
         FROM runs r
         INNER JOIN players p ON p.id = r.player_id
         ORDER BY r.total_score DESC
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
