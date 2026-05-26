-- Cactus Clans D1 schema.
-- Apply with `npm run db:apply` (against remote) or `npm run db:apply:local`.

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  nickname TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  clan TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  total_score INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS runs_total_score_idx ON runs (total_score DESC);

CREATE TABLE IF NOT EXISTS level_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  level_number INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  mini_game_points INTEGER NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  score INTEGER NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
