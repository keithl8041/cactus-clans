import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import {
  getCurrentSession,
  getKnownPlayers,
  removeKnownPlayer,
  setActivePlayer,
  type KnownPlayer,
  type PlayerSession,
} from '../services/session';
import { getActiveRun } from '../services/progress';
import { IosInstallHint } from './IosInstallHint';

export function SplashScreen() {
  const navigate = useNavigate();
  const setPlayer = useGameStore((s) => s.setPlayer);
  const setRun = useGameStore((s) => s.setRun);
  const player = useGameStore((s) => s.player);

  const [roster, setRoster] = useState<KnownPlayer[]>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void (async () => {
      setRoster(getKnownPlayers());
      const session = getCurrentSession();
      if (session) {
        setPlayer(session);
        const run = await getActiveRun(session.id);
        if (run) setRun(run);
      }
    })();
  }, [setPlayer, setRun]);

  async function choosePlayer(p: KnownPlayer) {
    const session: PlayerSession = { id: p.id, nickname: p.nickname };
    setActivePlayer(session);
    setPlayer(session);
    const run = await getActiveRun(p.id);
    setRun(run ?? null);
    navigate(run ? '/journey' : '/clans');
  }

  function forgetPlayer(p: KnownPlayer) {
    removeKnownPlayer(p.id);
    const remaining = getKnownPlayers();
    setRoster(remaining);
    if (player?.id === p.id) setPlayer(null);
    if (remaining.length === 0) setEditing(false);
  }

  function addPlayer() {
    navigate('/nickname');
  }

  return (
    <div className="screen">
      <img src="/logo.jpg" alt="Cactus Clans" className="logo" />
      <IosInstallHint />
      {roster.length === 0 ? (
        <>
          <h2>An adventure through the prickly wilds</h2>
          <div className="row">
            <button className="primary" onClick={addPlayer}>
              Start
            </button>
            <button onClick={() => navigate('/leaderboard')}>Leaderboard</button>
          </div>
        </>
      ) : (
        <>
          <h2>Who's playing?</h2>
          <div className="player-list">
            {roster.map((p) => (
              <div key={p.id} className="player-row">
                <button
                  className={`player-select${player?.id === p.id ? ' primary' : ''}`}
                  onClick={() => choosePlayer(p)}
                  disabled={editing}
                >
                  {p.nickname}
                </button>
                {editing && (
                  <button
                    className="player-remove"
                    aria-label={`Forget ${p.nickname}`}
                    onClick={() => forgetPlayer(p)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="row">
            <button onClick={addPlayer}>+ Add player</button>
            <button onClick={() => setEditing((e) => !e)}>{editing ? 'Done' : 'Edit'}</button>
            <button onClick={() => navigate('/leaderboard')}>Leaderboard</button>
          </div>
        </>
      )}
    </div>
  );
}
