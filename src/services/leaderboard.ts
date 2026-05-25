import { apiFetch, usingRealBackend } from './api';

export interface LeaderboardEntry {
  nickname: string;
  clan: string;
  totalScore: number;
  completedAt?: string;
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
    }
    const rows = await apiFetch<ApiRow[]>(`/leaderboard?limit=${limit}`);
    return rows.map((r) => ({
      nickname: r.nickname,
      clan: r.clan,
      totalScore: r.totalScore,
      completedAt: r.completedAt ?? undefined,
    }));
  }

  return readMock()
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit);
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
