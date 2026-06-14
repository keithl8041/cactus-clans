import { apiFetch, usingRealBackend } from './api';
import { getAllRunsForPlayer } from './progress';

export interface LeaderboardEntry {
  nickname: string;
  clan: string;
  totalScore: number;
  completedAt?: string;
  currentLevel?: number;
  allClansCompleted?: boolean;
}

export interface PlayerRunSummary {
  clan: string;
  totalScore: number;
  completedAt?: string;
  currentLevel: number;
  startedAt: string;
}

const MOCK_BOARD_KEY = 'cc.leaderboard.mock.v1';

interface MockRow extends LeaderboardEntry {
  playerId: string;
}

function readMock(): MockRow[] {
  try {
    const raw = localStorage.getItem(MOCK_BOARD_KEY);
    return raw ? (JSON.parse(raw) as MockRow[]) : [];
  } catch {
    return [];
  }
}

function writeMock(rows: MockRow[]): void {
  localStorage.setItem(MOCK_BOARD_KEY, JSON.stringify(rows));
}

export async function fetchLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  if (usingRealBackend) {
    interface ApiRow {
      nickname: string;
      clan: string;
      totalScore: number;
      completedAt: string | null;
      currentLevel: number | null;
      allClansCompleted: number;
    }
    const rows = await apiFetch<ApiRow[]>(`/leaderboard?limit=${limit}`);
    return rows.map((r) => ({
      nickname: r.nickname,
      clan: r.clan,
      totalScore: r.totalScore,
      completedAt: r.completedAt ?? undefined,
      currentLevel: r.currentLevel ?? undefined,
      allClansCompleted: r.allClansCompleted === 1,
    }));
  }

  // Dedup by nickname (highest score wins) to mirror the worker's SQL.
  const byName = new Map<string, MockRow>();
  for (const row of readMock()) {
    const prior = byName.get(row.nickname);
    if (!prior || row.totalScore > prior.totalScore) byName.set(row.nickname, row);
  }
  return [...byName.values()]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit);
}

export interface TeamLeaderboardEntry {
  /** Display name of the team, e.g. "Alice & Bob" (sorted pair). */
  teamLabel: string;
  score: number;
  recordedAt?: string;
}

/**
 * Co-op (versus) team high scores — one row per nickname pair, their best
 * round. Versus mode requires the Worker, so there is no localStorage path:
 * in dev (`usingRealBackend === false`) there's no multiplayer and we return
 * an empty board.
 */
export async function fetchTeamLeaderboard(limit = 50): Promise<TeamLeaderboardEntry[]> {
  if (!usingRealBackend) return [];
  interface ApiRow {
    teamLabel: string;
    score: number;
    recordedAt: string | null;
  }
  const rows = await apiFetch<ApiRow[]>(`/team-leaderboard?limit=${limit}`);
  return rows.map((r) => ({
    teamLabel: r.teamLabel,
    score: r.score,
    recordedAt: r.recordedAt ?? undefined,
  }));
}

/**
 * Mock-only: upsert the player's leaderboard row. Called on every level
 * attempt so partial/failed runs still appear. The real backend leaderboard
 * is populated automatically via `recordLevelResult` and `completeRun` in
 * progress.ts.
 */
export function submitMockRun(entry: MockRow): void {
  if (usingRealBackend) return;
  const all = readMock().filter((r) => r.playerId !== entry.playerId);
  all.push(entry);
  writeMock(all);
}

export async function fetchPlayerRuns(playerId: string): Promise<PlayerRunSummary[]> {
  if (usingRealBackend) {
    interface ApiRow {
      clan: string;
      totalScore: number;
      completedAt: string | null;
      currentLevel: number;
      startedAt: string;
    }
    const rows = await apiFetch<ApiRow[]>(`/players/${encodeURIComponent(playerId)}/runs`);
    return rows.map((r) => ({
      clan: r.clan,
      totalScore: r.totalScore,
      completedAt: r.completedAt ?? undefined,
      currentLevel: r.currentLevel,
      startedAt: r.startedAt,
    }));
  }

  // Offline fallback: read from localStorage directly.
  return getAllRunsForPlayer(playerId).map((r) => ({
    clan: r.clan,
    totalScore: r.totalScore,
    completedAt: r.completedAt,
    currentLevel: r.levels.reduce((max, l) => Math.max(max, l.levelNumber), 1),
    startedAt: r.startedAt,
  }));
}

// ---------------------------------------------------------------------------
// Demo leaderboard (JKPS Summer Fair)
// ---------------------------------------------------------------------------

const DEMO_BOARD_KEY = 'cc.leaderboard.demo.v1';

export interface DemoLeaderboardEntry {
  nickname: string;
  score: number;
}

interface MockDemoRow extends DemoLeaderboardEntry {
  /* stored as-is; dedup by nickname on read */
}

function readMockDemo(): MockDemoRow[] {
  try {
    const raw = localStorage.getItem(DEMO_BOARD_KEY);
    return raw ? (JSON.parse(raw) as MockDemoRow[]) : [];
  } catch {
    return [];
  }
}

function writeMockDemo(rows: MockDemoRow[]): void {
  localStorage.setItem(DEMO_BOARD_KEY, JSON.stringify(rows));
}

/** Fetch the JKPS Summer Fair demo leaderboard (best score per nickname). */
export async function fetchDemoLeaderboard(limit = 50): Promise<DemoLeaderboardEntry[]> {
  if (usingRealBackend) {
    // Bust both the Cloudflare edge cache (keyed on full URL) and the browser
    // HTTP cache so the summer-fair display board (/demo-board) shows live
    // scores instead of a 30s-stale snapshot from withEdgeCache in the Worker.
    const rows = await apiFetch<DemoLeaderboardEntry[]>(
      `/demo-leaderboard?limit=${limit}&_t=${Date.now()}`,
      { cache: 'no-store' },
    );
    return rows;
  }

  // Dedup by nickname (highest score wins).
  const byName = new Map<string, MockDemoRow>();
  for (const row of readMockDemo()) {
    const prior = byName.get(row.nickname);
    if (!prior || row.score > prior.score) byName.set(row.nickname, row);
  }
  return [...byName.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Submit a score to the JKPS Summer Fair demo leaderboard. */
export async function submitDemoScore(entry: { nickname: string; score: number }): Promise<void> {
  if (usingRealBackend) {
    await apiFetch('/demo-scores', {
      method: 'POST',
      body: JSON.stringify({ nickname: entry.nickname, score: entry.score }),
    });
    return;
  }

  // Dev mode: append to localStorage (fetchDemoLeaderboard deduplicates).
  const all = readMockDemo();
  all.push({ nickname: entry.nickname, score: entry.score });
  writeMockDemo(all);
}
