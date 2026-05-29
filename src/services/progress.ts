import { apiFetch, usingRealBackend } from './api';

export interface LevelClearRecord {
  levelNumber: number;
  passed: boolean;
  miniGamePoints: number;
  elapsedMs: number;
  score: number;
  recordedAt: string;
}

export interface RunProgress {
  runId: string;
  playerId: string;
  clan: string;
  startedAt: string;
  completedAt?: string;
  totalScore: number;
  levels: LevelClearRecord[];
}

const RUN_KEY = (playerId: string) => `cc.run.${playerId}.v1`;

function readRun(playerId: string): RunProgress | null {
  try {
    const raw = localStorage.getItem(RUN_KEY(playerId));
    return raw ? (JSON.parse(raw) as RunProgress) : null;
  } catch {
    return null;
  }
}

function writeRun(run: RunProgress): void {
  localStorage.setItem(RUN_KEY(run.playerId), JSON.stringify(run));
}

function localRunId(playerId: string): string {
  return `run-${playerId}-${Date.now()}`;
}

export async function startRun(playerId: string, clan: string): Promise<RunProgress> {
  if (usingRealBackend) {
    const created = await apiFetch<{ id: string; startedAt: string }>('/runs', {
      method: 'POST',
      body: JSON.stringify({ playerId, clan }),
    });
    const run: RunProgress = {
      runId: created.id,
      playerId,
      clan,
      startedAt: created.startedAt,
      totalScore: 0,
      levels: [],
    };
    writeRun(run);
    return run;
  }

  const run: RunProgress = {
    runId: localRunId(playerId),
    playerId,
    clan,
    startedAt: new Date().toISOString(),
    totalScore: 0,
    levels: [],
  };
  writeRun(run);
  return run;
}

export async function getActiveRun(playerId: string): Promise<RunProgress | null> {
  // localStorage is the source of truth for the active run even when the real
  // backend is wired up — keeps in-progress state snappy and survives refreshes.
  // Cross-device sync happens at sign-in via `syncActiveRunFromServer`.
  return readRun(playerId);
}

/**
 * Sign-in-time hydration: pull the latest in-progress run from the Worker and
 * reconcile it with any state cached on this device. Without this, signing in
 * on a fresh device left `getActiveRun` reading an empty localStorage and you
 * lost cross-device progress.
 *
 * Reconciliation rules:
 *   - Backend offline (or DEV fallback) → trust local cache.
 *   - Server has no in-progress run → drop any stale local cache (the canonical
 *     run was completed elsewhere; the local copy is from a finished session).
 *   - Server + local disagree on runId → trust server (it spans devices).
 *   - Same runId on both → merge level_results using the client's replay rule
 *     so any unsynced local progress survives.
 */
export async function syncActiveRunFromServer(playerId: string): Promise<RunProgress | null> {
  const local = readRun(playerId);
  if (!usingRealBackend) return local;

  let serverRun: RunProgress | null;
  try {
    const res = await apiFetch<{ run: RunProgress | null }>(
      `/players/${encodeURIComponent(playerId)}/active-run`,
    );
    serverRun = res.run;
  } catch (err) {
    console.warn('active-run sync failed', err);
    return local;
  }

  if (!serverRun) {
    if (local) clearActiveRun(playerId);
    return null;
  }
  if (!local || local.runId !== serverRun.runId) {
    writeRun(serverRun);
    return serverRun;
  }
  const merged = mergeRunLevels(local, serverRun);
  writeRun(merged);
  return merged;
}

function mergeRunLevels(a: RunProgress, b: RunProgress): RunProgress {
  const byLevel = new Map<number, LevelClearRecord>();
  for (const lvl of [...a.levels, ...b.levels]) {
    const prior = byLevel.get(lvl.levelNumber);
    byLevel.set(lvl.levelNumber, prior ? pickBetterLevel(prior, lvl) : lvl);
  }
  const levels = [...byLevel.values()].sort((x, y) => x.levelNumber - y.levelNumber);
  const totalScore = levels.reduce((acc, l) => acc + l.score, 0);
  return {
    runId: a.runId,
    playerId: a.playerId,
    clan: a.clan,
    startedAt: a.startedAt < b.startedAt ? a.startedAt : b.startedAt,
    completedAt: a.completedAt ?? b.completedAt,
    totalScore,
    levels,
  };
}

function pickBetterLevel(prior: LevelClearRecord, next: LevelClearRecord): LevelClearRecord {
  if (prior.passed && !next.passed) return prior;
  if (!prior.passed && next.passed) return next;
  return next.score > prior.score ? next : prior;
}

/**
 * Clears the active run from localStorage so the next clan pick creates a
 * fresh run in D1. The previous (completed) run stays in `runs` — leaderboard
 * picks the highest-scoring run per player at read time.
 */
export function clearActiveRun(playerId: string): void {
  localStorage.removeItem(RUN_KEY(playerId));
}

export async function recordLevelResult(
  run: RunProgress,
  record: Omit<LevelClearRecord, 'recordedAt'>,
): Promise<RunProgress> {
  // Once a run is submitted, replays are practice only — no score updates
  // locally or in D1. This stops players from gaming the leaderboard by
  // grinding bonus pickups on already-cleared levels after submission.
  if (run.completedAt) return run;
  const recorded: LevelClearRecord = { ...record, recordedAt: new Date().toISOString() };
  // Replay rule: a pass is sticky (a later fail can't un-clear a level);
  // otherwise keep the higher score. Bonus pickups mean failed runs can outscore
  // earlier passes, but we still don't want them to downgrade clear status.
  const prior = run.levels.find((l) => l.levelNumber === recorded.levelNumber);
  const keep = prior ? pickBetterLevel(prior, recorded) : recorded;
  const levels = run.levels.filter((l) => l.levelNumber !== recorded.levelNumber).concat(keep);
  const totalScore = levels.reduce((acc, l) => acc + l.score, 0);
  const next: RunProgress = { ...run, levels, totalScore };
  writeRun(next);

  if (usingRealBackend) {
    try {
      await apiFetch(`/runs/${encodeURIComponent(run.runId)}/levels`, {
        method: 'POST',
        body: JSON.stringify({
          levelNumber: recorded.levelNumber,
          passed: recorded.passed,
          miniGamePoints: recorded.miniGamePoints,
          elapsedMs: recorded.elapsedMs,
          score: recorded.score,
          totalScore,
        }),
      });
    } catch (err) {
      console.warn('level_results write failed', err);
    }
  }
  return next;
}

export async function completeRun(run: RunProgress): Promise<RunProgress> {
  const completedAt = new Date().toISOString();
  const next: RunProgress = { ...run, completedAt };
  writeRun(next);
  if (usingRealBackend) {
    try {
      await apiFetch(`/runs/${encodeURIComponent(run.runId)}/complete`, {
        method: 'POST',
        body: JSON.stringify({ totalScore: run.totalScore }),
      });
    } catch (err) {
      console.warn('run complete failed', err);
    }
  }
  return next;
}
