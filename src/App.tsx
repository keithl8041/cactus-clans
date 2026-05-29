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
// Versus mode shares the same Phaser bundle path — lazy-load so the easter-egg
// route doesn't bloat the main entry for everyone who never visits it.
const VersusLobby = lazy(() =>
  import('./shell/VersusLobby').then((m) => ({ default: m.VersusLobby })),
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
      <Route
        path="/versus/:code"
        element={
          <Suspense fallback={<div className="screen"><h2>Joining lobby…</h2></div>}>
            <VersusLobby />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
