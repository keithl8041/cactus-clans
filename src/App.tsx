import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LandingPage } from './shell/LandingPage';
import { SplashScreen } from './shell/SplashScreen';
import { NicknameEntry } from './shell/NicknameEntry';
import { ClanSelect } from './shell/ClanSelect';
import { LevelMap } from './shell/LevelMap';
import { Leaderboard } from './shell/Leaderboard';
import { StorePage } from './shell/StorePage';
import { PrivacyPolicy } from './shell/PrivacyPolicy';
import { Footer } from './shell/Footer';
import { useGameStore } from './store/gameStore';
import {
  DEFAULT_PENDING_SYNC_MESSAGE,
  RUN_CHANGE_EVENT,
  type RunChangeDetail,
} from './services/progress';

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
  const playerId = useGameStore((s) => s.player?.id);
  const run = useGameStore((s) => s.run);
  const setRun = useGameStore((s) => s.setRun);
  // Hide the footer in-game so it doesn't overlap Phaser scenes.
  const inGame = location.pathname.startsWith('/play/');

  useEffect(() => {
    function onRunChange(event: Event) {
      const { playerId: changedPlayerId, run: nextRun } = (event as CustomEvent<RunChangeDetail>).detail;
      if (playerId && changedPlayerId === playerId) setRun(nextRun);
    }

    window.addEventListener(RUN_CHANGE_EVENT, onRunChange);
    return () => window.removeEventListener(RUN_CHANGE_EVENT, onRunChange);
  }, [playerId, setRun]);

  return (
    <>
      {run?.pendingSync && (
        <div className="sync-banner" role="status">
          {run.lastSyncError ?? DEFAULT_PENDING_SYNC_MESSAGE}
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
        <Route path="/privacy" element={<PrivacyPolicy />} />
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
