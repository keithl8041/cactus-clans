import { supabase } from './supabase';

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
  if (supabase) {
    // Best (max) total_score per player across completed runs.
    const { data, error } = await supabase
      .from('runs')
      .select('total_score, completed_at, clan, players!inner(nickname)')
      .not('completed_at', 'is', null)
      .order('total_score', { ascending: false })
      .limit(limit);
    if (error) throw error;
    type Row = {
      total_score: number;
      completed_at: string;
      clan: string;
      players: { nickname: string } | { nickname: string }[];
    };
    return (data as Row[]).map((r) => ({
      nickname: Array.isArray(r.players) ? r.players[0]?.nickname ?? '?' : r.players.nickname,
      clan: r.clan,
      totalScore: r.total_score,
      completedAt: r.completed_at,
    }));
  }

  return readMock()
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit);
}

/**
 * Mock-only: record a completed run on the local leaderboard. The real
 * backend leaderboard is populated automatically via `recordLevelResult` and
 * `completeRun` in progress.ts.
 */
export function submitMockRun(entry: MockRow): void {
  if (supabase) return;
  const all = readMock().filter((r) => r.playerId !== entry.playerId);
  all.push(entry);
  writeMock(all);
}
