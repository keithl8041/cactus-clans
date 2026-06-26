import { apiFetch, usingRealBackend } from './api';

const COMPLETED_COUNT_KEY = (playerId: string) => `cc.completed.count.${playerId}`;

export async function getCompletedRunCount(playerId: string): Promise<number> {
  if (usingRealBackend) {
    try {
      const res = await apiFetch<{ count: number }>(
        `/players/${encodeURIComponent(playerId)}/completed-runs`,
      );
      return res.count;
    } catch {
      // fall through to localStorage
    }
  }
  return parseInt(localStorage.getItem(COMPLETED_COUNT_KEY(playerId)) ?? '0', 10);
}

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

const RUN_KEY_PREFIX = 'cc.run.v2.';
const RUN_KEY = (playerId: string, clan: string) =>
  `${RUN_KEY_PREFIX}${playerId}|${encodeURIComponent(clan)}`;
const LEGACY_RUN_KEY = (playerId: string) => `cc.run.${playerId}.v1`;
const ACTIVE_CLAN_KEY = (playerId: string) => `cc.run.active.${playerId}.v1`;
const LOCAL_RUN_PREFIX = 'local-run-';
const RETRY_BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000] as const;
const retryTimers = new Map<string, number>();
const retryCounts = new Map<string, number>();
let syncInitialized = false;

function retryKey(playerId: string, clan: string): string {
  return `${playerId}|${clan}`;
}

function readActiveClan(playerId: string): string | null {
  const raw = localStorage.getItem(ACTIVE_CLAN_KEY(playerId));
  return raw?.trim() || null;
}

function writeActiveClan(playerId: string, clan: string): void {
  localStorage.setItem(ACTIVE_CLAN_KEY(playerId), clan);
}

function clearActiveClan(playerId: string): void {
  localStorage.removeItem(ACTIVE_CLAN_KEY(playerId));
}

function migrateLegacyRun(playerId: string): void {
  const legacyKey = LEGACY_RUN_KEY(playerId);
  const raw = localStorage.getItem(legacyKey);
  if (!raw) return;
  try {
    const run = JSON.parse(raw) as RunProgress;
    if (run?.playerId === playerId && run.clan) {
      const nextKey = RUN_KEY(playerId, run.clan);
      if (!localStorage.getItem(nextKey)) {
        localStorage.setItem(nextKey, JSON.stringify(run));
      }
      writeActiveClan(playerId, run.clan);
    }
  } catch {
    // ignore malformed legacy cache
  } finally {
    localStorage.removeItem(legacyKey);
  }
}

function runKeyParts(key: string): { playerId: string; clan: string } | null {
  if (!key.startsWith(RUN_KEY_PREFIX)) return null;
  const body = key.slice(RUN_KEY_PREFIX.length);
  const sep = body.indexOf('|');
  if (sep <= 0 || sep >= body.length - 1) return null;
  const playerId = body.slice(0, sep);
  const clan = decodeURIComponent(body.slice(sep + 1));
  if (!playerId || !clan) return null;
  return { playerId, clan };
}

function readRun(playerId: string, clan: string): RunProgress | null {
  try {
    const raw = localStorage.getItem(RUN_KEY(playerId, clan));
    return raw ? (JSON.parse(raw) as RunProgress) : null;
  } catch {
    return null;
  }
}

export function getAllRunsForPlayer(playerId: string): RunProgress[] {
  return readRunsForPlayer(playerId);
}

function readRunsForPlayer(playerId: string): RunProgress[] {
  migrateLegacyRun(playerId);
  const runs: RunProgress[] = [];
  const prefix = `${RUN_KEY_PREFIX}${playerId}|`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const run = JSON.parse(raw) as RunProgress;
      if (run?.playerId === playerId && run.clan) runs.push(run);
    } catch {
      // skip malformed cache entry
    }
  }
  return runs;
}

function preferredRun(runs: RunProgress[]): RunProgress | null {
  let best: RunProgress | null = null;
  for (const run of runs) {
    if (!best) {
      best = run;
      continue;
    }
    if (!!best.completedAt !== !!run.completedAt) {
      if (!run.completedAt) best = run;
      continue;
    }
    if (run.startedAt > best.startedAt) best = run;
  }
  return best;
}

function readActiveRun(playerId: string): RunProgress | null {
  migrateLegacyRun(playerId);
  const activeClan = readActiveClan(playerId);
  if (activeClan) {
    const active = readRun(playerId, activeClan);
    if (active) return active;
    clearActiveClan(playerId);
  }
  const fallback = preferredRun(readRunsForPlayer(playerId));
  if (fallback) writeActiveClan(playerId, fallback.clan);
  return fallback;
}

function writeRun(
  run: RunProgress,
  options: { activate?: boolean; notify?: boolean } = {},
): void {
  const activate = options.activate ?? true;
  localStorage.setItem(RUN_KEY(run.playerId, run.clan), JSON.stringify(run));
  if (activate) writeActiveClan(run.playerId, run.clan);
  const notify = options.notify ?? true;
  if (!notify) return;
  if (activate || readActiveClan(run.playerId) === run.clan) {
    notifyRunChange(run.playerId, run);
  }
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

function needsSync(run: RunProgress | null | undefined): boolean {
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

async function syncRunToServer(
  run: RunProgress,
  options: { activate?: boolean; notify?: boolean } = {},
): Promise<RunProgress> {
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
    writeRun(next, options);
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
  writeRun(synced, options);
  clearRunRetry(run.playerId, run.clan);
  return synced;
}

async function flushPendingRun(playerId: string, clan: string): Promise<RunProgress | null> {
  if (!usingRealBackend) return readRun(playerId, clan);
  const run = readRun(playerId, clan);
  if (!run) return null;
  if (!needsSync(run)) return run;
  try {
    return await syncRunToServer(run, { activate: readActiveClan(playerId) === clan });
  } catch (err) {
    const latest = readRun(playerId, clan);
    const pending = markPendingSync(latest ?? run, err);
    writeRun(pending, { activate: readActiveClan(playerId) === clan });
    scheduleRunRetry(playerId, clan);
    return pending;
  }
}

function clearRunRetry(playerId: string, clan: string): void {
  const key = retryKey(playerId, clan);
  retryCounts.delete(key);
  const timer = retryTimers.get(key);
  if (timer != null && typeof window !== 'undefined') {
    window.clearTimeout(timer);
    retryTimers.delete(key);
  }
}

function scheduleRunRetry(playerId: string, clan: string): void {
  if (!usingRealBackend || typeof window === 'undefined') return;
  const key = retryKey(playerId, clan);
  const existing = retryTimers.get(key);
  if (existing != null) window.clearTimeout(existing);
  const attempt = retryCounts.get(key) ?? 0;
  const delay = RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
  retryCounts.set(key, attempt + 1);
  const timer = window.setTimeout(() => {
    retryTimers.delete(key);
    void flushPendingRun(playerId, clan);
  }, delay);
  retryTimers.set(key, timer);
}

function pendingRuns(): Array<{ playerId: string; clan: string }> {
  const runs: Array<{ playerId: string; clan: string }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(RUN_KEY_PREFIX)) continue;
    const parts = runKeyParts(key);
    if (parts) runs.push(parts);
  }
  return runs;
}

async function flushPendingRuns(): Promise<void> {
  if (!usingRealBackend) return;
  for (const run of pendingRuns()) {
    await flushPendingRun(run.playerId, run.clan);
  }
}

export function initProgressSync(): void {
  if (!usingRealBackend || syncInitialized || typeof window === 'undefined') return;
  syncInitialized = true;

  const flushPendingSync = () => {
    void flushPendingRuns();
  };

  window.addEventListener('online', flushPendingSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushPendingSync();
  });
  window.setTimeout(flushPendingSync, 0);
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
      scheduleRunRetry(playerId, clan);
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
  return readActiveRun(playerId);
}

/**
 * Sign-in-time hydration: pull the latest in-progress run from the Worker and
 * reconcile it with any state cached on this device. Without this, signing in
 * on a fresh device left `getActiveRun` reading an empty localStorage and you
 * lost cross-device progress.
 *
 * Reconciliation rules:
 *   - Backend offline (or DEV fallback) → trust local cache.
 *   - Server has no matching run → keep any local cache for offline resilience.
 *   - Server + local disagree on runId → trust server (it spans devices).
 *   - Same runId on both → merge level_results using the client's replay rule
 *     so any unsynced local progress survives.
 */
export async function syncActiveRunFromServer(
  playerId: string,
  clan?: string,
): Promise<RunProgress | null> {
  const targetClan = clan ?? readActiveRun(playerId)?.clan ?? null;
  let local = targetClan ? readRun(playerId, targetClan) : readActiveRun(playerId);
  if (!usingRealBackend) return local;

  if (targetClan && needsSync(local)) {
    const synced = await flushPendingRun(playerId, targetClan);
    if (needsSync(synced)) return synced;
    local = synced;
  }

  let serverRun: RunProgress | null;
  try {
    const queryString = clan ? `?clan=${encodeURIComponent(clan)}` : '';
    const res = await apiFetch<{ run: RunProgress | null }>(
      `/players/${encodeURIComponent(playerId)}/active-run${queryString}`,
    );
    serverRun = res.run;
  } catch (err) {
    console.warn('active-run sync failed', err);
    return local;
  }
  if (!serverRun) {
    // Changed behavior: preserve local state instead of clearing it when the
    // server has no matching run, so offline/unsynced progress is never erased.
    return local;
  }
  if (!local || local.runId !== serverRun.runId) {
    writeRun(serverRun);
    return serverRun;
  }
  const merged = mergeRunLevels(local, serverRun);
  writeRun(merged);
  return merged;
}

export async function getOrCreateRunForClan(playerId: string, clan: string): Promise<RunProgress> {
  const existing = await syncActiveRunFromServer(playerId, clan);
  if (existing) return existing;
  return startRun(playerId, clan);
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
 * Clears only the currently-active clan run from localStorage.
 */
export function clearActiveRun(playerId: string): void {
  const activeClan = readActiveClan(playerId);
  if (!activeClan) return;
  localStorage.removeItem(RUN_KEY(playerId, activeClan));
  clearActiveClan(playerId);
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
      clearRunRetry(run.playerId, run.clan);
      return synced;
    } catch (err) {
      const latest = readRun(run.playerId, run.clan);
      const pending = markPendingSync(latest ?? next, err);
      writeRun(pending);
      scheduleRunRetry(run.playerId, run.clan);
      return pending;
    }
  }
  return next;
}

export async function completeRun(run: RunProgress): Promise<RunProgress> {
  const completedAt = new Date().toISOString();
  const next: RunProgress = { ...run, completedAt };
  writeRun(next);
  const cKey = COMPLETED_COUNT_KEY(run.playerId);
  localStorage.setItem(cKey, String(parseInt(localStorage.getItem(cKey) ?? '0', 10) + 1));
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
      clearRunRetry(run.playerId, run.clan);
      return synced;
    } catch (err) {
      const latest = readRun(run.playerId, run.clan);
      const pending = markPendingSync(latest ?? next, err);
      writeRun(pending);
      scheduleRunRetry(run.playerId, run.clan);
      return pending;
    }
  }
  return next;
}
