import { apiFetch, usingRealBackend } from './api';

export interface LeaderboardEntry {
  nickname: string;
  clan: string;
  totalScore: number;
  completedAt?: string;
  currentLevel?: number;
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
    }
    const rows = await apiFetch<ApiRow[]>(`/leaderboard?limit=${limit}`);
    return rows.map((r) => ({
      nickname: r.nickname,
      clan: r.clan,
      totalScore: r.totalScore,
      completedAt: r.completedAt ?? undefined,
      currentLevel: r.currentLevel ?? undefined,
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
