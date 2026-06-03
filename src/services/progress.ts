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
  pendingSync?: boolean;
  lastSyncError?: string;
}

export const RUN_CHANGE_EVENT = 'cc:run-change';
export const DEFAULT_PENDING_SYNC_MESSAGE =
  'Progress is saved on this device and will retry automatically.';

export interface RunChangeDetail {
  playerId: string;
  run: RunProgress | null;
}

const RUN_KEY = (playerId: string) => `cc.run.${playerId}.v1`;
const LOCAL_RUN_PREFIX = 'local-run-';
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000] as const;
const retryTimers = new Map<string, number>();
const retryCounts = new Map<string, number>();
let syncInitialized = false;

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
  notifyRunChange(run.playerId, run);
}

function localRunId(playerId: string): string {
  return `${LOCAL_RUN_PREFIX}${playerId}-${Date.now()}`;
}

function isLocalRunId(runId: string): boolean {
  return runId.startsWith(LOCAL_RUN_PREFIX);
}

function clearSyncState(run: RunProgress): RunProgress {
  return {
    ...run,
    pendingSync: undefined,
    lastSyncError: undefined,
  };
}

function markPendingSync(run: RunProgress, err: unknown): RunProgress {
  const offline =
    typeof navigator !== 'undefined' && navigator.onLine === false;
  const lastSyncError = offline
    ? 'Offline — progress is saved on this device and will retry automatically.'
    : `Couldn't reach the server — progress is saved on this device and we'll keep retrying.`;
  console.warn('run sync deferred', err);
  return {
    ...run,
    pendingSync: true,
    lastSyncError,
  };
}

function sortedLevels(run: RunProgress): LevelClearRecord[] {
  return [...run.levels].sort((a, b) => a.levelNumber - b.levelNumber);
}

function needsSync(run: RunProgress | null | undefined): run is RunProgress {
  return !!run && (run.pendingSync || isLocalRunId(run.runId));
}

function notifyRunChange(playerId: string, run: RunProgress | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<RunChangeDetail>(RUN_CHANGE_EVENT, {
      detail: { playerId, run },
    }),
  );
}

async function syncRunToServer(run: RunProgress): Promise<RunProgress> {
  let next = clearSyncState(run);

  if (isLocalRunId(next.runId)) {
    const created = await apiFetch<{ id: string; startedAt: string }>('/runs', {
      method: 'POST',
      body: JSON.stringify({ playerId: next.playerId, clan: next.clan }),
    });
    next = {
      ...next,
      runId: created.id,
      startedAt: created.startedAt,
    };
  }

  for (const level of sortedLevels(next)) {
    await apiFetch(`/runs/${encodeURIComponent(next.runId)}/levels`, {
      method: 'POST',
      body: JSON.stringify({
        levelNumber: level.levelNumber,
        passed: level.passed,
        miniGamePoints: level.miniGamePoints,
        elapsedMs: level.elapsedMs,
        score: level.score,
        totalScore: next.totalScore,
      }),
    });
  }

  if (next.completedAt) {
    await apiFetch(`/runs/${encodeURIComponent(next.runId)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ totalScore: next.totalScore }),
    });
  }

  const synced = clearSyncState(next);
  writeRun(synced);
  clearRunRetry(run.playerId);
  return synced;
}

async function flushPendingRun(playerId: string): Promise<RunProgress | null> {
  if (!usingRealBackend) return readRun(playerId);
  const run = readRun(playerId);
  if (!run) return null;
  if (!needsSync(run)) return run;
  try {
    return await syncRunToServer(run);
  } catch (err) {
    const pending = markPendingSync(run, err);
    writeRun(pending);
    scheduleRunRetry(playerId);
    return pending;
  }
}

function clearRunRetry(playerId: string): void {
  retryCounts.delete(playerId);
  const timer = retryTimers.get(playerId);
  if (timer != null && typeof window !== 'undefined') {
    window.clearTimeout(timer);
    retryTimers.delete(playerId);
  }
}

function scheduleRunRetry(playerId: string): void {
  if (!usingRealBackend || typeof window === 'undefined') return;
  const existing = retryTimers.get(playerId);
  if (existing != null) window.clearTimeout(existing);
  const attempt = retryCounts.get(playerId) ?? 0;
  const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
  retryCounts.set(playerId, attempt + 1);
  const timer = window.setTimeout(() => {
    retryTimers.delete(playerId);
    void flushPendingRun(playerId);
  }, delay);
  retryTimers.set(playerId, timer);
}

function pendingPlayerIds(): string[] {
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('cc.run.') || !key.endsWith('.v1')) continue;
    const playerId = key.slice('cc.run.'.length, -'.v1'.length);
    if (playerId) ids.push(playerId);
  }
  return ids;
}

async function flushPendingRuns(): Promise<void> {
  if (!usingRealBackend) return;
  for (const playerId of pendingPlayerIds()) {
    await flushPendingRun(playerId);
  }
}

export function initProgressSync(): void {
  if (!usingRealBackend || syncInitialized || typeof window === 'undefined') return;
  syncInitialized = true;

  const trigger = () => {
    void flushPendingRuns();
  };

  window.addEventListener('online', trigger);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') trigger();
  });
  window.setTimeout(trigger, 0);
}

export async function startRun(playerId: string, clan: string): Promise<RunProgress> {
  if (usingRealBackend) {
    try {
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
    } catch (err) {
      const run: RunProgress = {
        runId: localRunId(playerId),
        playerId,
        clan,
        startedAt: new Date().toISOString(),
        totalScore: 0,
        levels: [],
      };
      const pending = markPendingSync(run, err);
      writeRun(pending);
      scheduleRunRetry(playerId);
      return pending;
    }
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
  let local = readRun(playerId);
  if (!usingRealBackend) return local;

  if (needsSync(local)) {
    const synced = await flushPendingRun(playerId);
    if (needsSync(synced)) return synced;
    local = synced;
  }

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
  notifyRunChange(playerId, null);
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
      if (next.pendingSync || isLocalRunId(next.runId)) {
        return (await syncRunToServer(next));
      }
      const synced = clearSyncState(next);
      await apiFetch(`/runs/${encodeURIComponent(next.runId)}/levels`, {
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
      writeRun(synced);
      clearRunRetry(run.playerId);
      return synced;
    } catch (err) {
      const pending = markPendingSync(next, err);
      writeRun(pending);
      scheduleRunRetry(run.playerId);
      return pending;
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
      if (next.pendingSync || isLocalRunId(next.runId)) {
        return (await syncRunToServer(next));
      }
      const synced = clearSyncState(next);
      await apiFetch(`/runs/${encodeURIComponent(next.runId)}/complete`, {
        method: 'POST',
        body: JSON.stringify({ totalScore: next.totalScore }),
      });
      writeRun(synced);
      clearRunRetry(run.playerId);
      return synced;
    } catch (err) {
      const pending = markPendingSync(next, err);
      writeRun(pending);
      scheduleRunRetry(run.playerId);
      return pending;
    }
  }
  return next;
}
