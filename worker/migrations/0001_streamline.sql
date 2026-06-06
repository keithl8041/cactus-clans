-- One-time migration: streamline D1 reads & writes.
-- Apply once against each DB, e.g.
--   wrangler d1 execute cactus-clans --local  --file=worker/migrations/0001_streamline.sql
--   wrangler d1 execute cactus-clans --remote --file=worker/migrations/0001_streamline.sql
--
-- Why a migration and not just `db:apply`: schema.sql is all CREATE ... IF NOT
-- EXISTS, so it can't add the new UNIQUE constraint / column to tables that
-- already exist. level_results has duplicate (run_id, level_number) rows today
-- (append-per-attempt), so the UNIQUE constraint can't be added in place — we
-- drop and recreate it. Pre-launch test data only; runs/players are preserved.

DROP TABLE IF EXISTS level_results;

CREATE TABLE level_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  level_number INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  mini_game_points INTEGER NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  score INTEGER NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_id, level_number)
);

-- Denormalized furthest-level-reached. Existing runs default to 1 and
-- self-correct on their next level write (MAX(current_level, level_number)).
ALTER TABLE runs ADD COLUMN current_level INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS runs_player_score_idx ON runs (player_id, total_score DESC);
