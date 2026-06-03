import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LandingPage } from './shell/LandingPage';
import { SplashScreen } from './shell/SplashScreen';
import { NicknameEntry } from './shell/NicknameEntry';
import { ClanSelect } from './shell/ClanSelect';
import { LevelMap } from './shell/LevelMap';
import { Leaderboard } from './shell/Leaderboard';
import { StorePage } from './shell/StorePage';
import { Footer } from './shell/Footer';
import { useGameStore } from './store/gameStore';

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
  const location = useLocation();
  const run = useGameStore((s) => s.run);
  // Hide the footer in-game so it doesn't overlap Phaser scenes.
  const inGame = location.pathname.startsWith('/play/');
  return (
    <>
      {run?.pendingSync && (
        <div className="sync-banner" role="status">
          {run.lastSyncError ?? 'Connection lost — progress is saved on this device and will retry automatically.'}
        </div>
      )}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/game" element={<SplashScreen />} />
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
        <Route path="/shop" element={<StorePage />} />
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
      {!inGame && <Footer />}
    </>
  );
}
