import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SplashScreen } from './shell/SplashScreen';
import { NicknameEntry } from './shell/NicknameEntry';
import { ClanSelect } from './shell/ClanSelect';
import { LevelMap } from './shell/LevelMap';
import { Leaderboard } from './shell/Leaderboard';

// Phaser is heavy — only load it when the player actually opens a level.
const GameContainer = lazy(() =>
  import('./shell/GameContainer').then((m) => ({ default: m.GameContainer })),
);

export function App() {
  return (
    <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route path="/nickname" element={<NicknameEntry />} />
      <Route path="/clans" element={<ClanSelect />} />
      <Route path="/journey" element={<LevelMap />} />
      <Route
        path="/play/:levelNumber"
        element={
          <Suspense fallback={<div className="screen"><h2>Loading game…</h2></div>}>
            <GameContainer />
          </Suspense>
        }
      />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
