import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { getCurrentSession } from '../services/session';
import { getActiveRun } from '../services/progress';

export function SplashScreen() {
  const navigate = useNavigate();
  const setPlayer = useGameStore((s) => s.setPlayer);
  const setRun = useGameStore((s) => s.setRun);

  useEffect(() => {
    void (async () => {
      const session = getCurrentSession();
      if (session) {
        setPlayer(session);
        const run = await getActiveRun(session.id);
        if (run) setRun(run);
      }
    })();
  }, [setPlayer, setRun]);

  const player = useGameStore((s) => s.player);
  const run = useGameStore((s) => s.run);

  function start() {
    if (!player) return navigate('/nickname');
    if (!run) return navigate('/clans');
    return navigate('/journey');
  }

  return (
    <div className="screen">
      <img src="/logo.jpg" alt="Cactus Clans" className="logo" />
      <h2>An adventure through the prickly wilds</h2>
      <div className="row">
        <button className="primary" onClick={start}>
          {player ? `Continue as ${player.nickname}` : 'Start'}
        </button>
        <button onClick={() => navigate('/leaderboard')}>Leaderboard</button>
      </div>
    </div>
  );
}
