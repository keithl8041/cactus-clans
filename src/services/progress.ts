import { supabase } from './supabase';

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
  if (supabase) {
    const { data, error } = await supabase
      .from('runs')
      .insert({ player_id: playerId, clan })
      .select('id, started_at')
      .single();
    if (error) throw error;
    const run: RunProgress = {
      runId: data.id,
      playerId,
      clan,
      startedAt: data.started_at ?? new Date().toISOString(),
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
  // localStorage is the source of truth for the active run even when Supabase
  // is wired up — keeps in-progress state snappy and survives quick refreshes.
  return readRun(playerId);
}

export async function recordLevelResult(
  run: RunProgress,
  record: Omit<LevelClearRecord, 'recordedAt'>,
): Promise<RunProgress> {
  const recorded: LevelClearRecord = { ...record, recordedAt: new Date().toISOString() };
  // Drop any prior attempt at the same level so the latest replaces it.
  const levels = run.levels.filter((l) => l.levelNumber !== recorded.levelNumber).concat(recorded);
  const totalScore = levels.reduce((acc, l) => acc + l.score, 0);
  const next: RunProgress = { ...run, levels, totalScore };
  writeRun(next);

  if (supabase) {
    const { error } = await supabase.from('level_results').insert({
      run_id: run.runId,
      level_number: recorded.levelNumber,
      passed: recorded.passed,
      mini_game_points: recorded.miniGamePoints,
      elapsed_ms: recorded.elapsedMs,
      score: recorded.score,
    });
    if (error) console.warn('level_results insert failed', error);
    await supabase.from('runs').update({ total_score: totalScore }).eq('id', run.runId);
  }
  return next;
}

export async function completeRun(run: RunProgress): Promise<RunProgress> {
  const completedAt = new Date().toISOString();
  const next: RunProgress = { ...run, completedAt };
  writeRun(next);
  if (supabase) {
    const { error } = await supabase
      .from('runs')
      .update({ completed_at: completedAt, total_score: run.totalScore })
      .eq('id', run.runId);
    if (error) console.warn('runs complete update failed', error);
  }
  return next;
}
