import { create } from 'zustand';
import type { PlayerSession } from '../services/session';
import type { RunProgress } from '../services/progress';

interface GameState {
  player: PlayerSession | null;
  run: RunProgress | null;
  setPlayer: (p: PlayerSession | null) => void;
  setRun: (r: RunProgress | null) => void;
  clear: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  player: null,
  run: null,
  setPlayer: (player) => set({ player }),
  setRun: (run) => set({ run }),
  clear: () => set({ player: null, run: null }),
}));

/** Highest cleared level number for the active run (0 if none cleared yet). */
export function highestClearedLevel(run: RunProgress | null): number {
  if (!run) return 0;
  const passed = run.levels.filter((l) => l.passed).map((l) => l.levelNumber);
  return passed.length === 0 ? 0 : Math.max(...passed);
}
