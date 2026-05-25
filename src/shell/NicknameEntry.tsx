import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithNickname } from '../services/session';
import { getActiveRun } from '../services/progress';
import { useGameStore } from '../store/gameStore';

export function NicknameEntry() {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const setPlayer = useGameStore((s) => s.setPlayer);
  const setRun = useGameStore((s) => s.setRun);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await signInWithNickname(nickname);
      setPlayer(session);
      // If this nickname already had a run on this device (or, with the real
      // backend, an existing player record), resume it rather than forcing a
      // new clan pick. Brand-new players have no run, so they still go to
      // /clans to pick.
      const run = await getActiveRun(session.id);
      setRun(run ?? null);
      navigate(run ? '/journey' : '/clans');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <h1>Who are you?</h1>
      <h2>Pick a nickname for the leaderboard</h2>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <input
          type="text"
          autoFocus
          value={nickname}
          maxLength={24}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="e.g. SpikyJoe"
        />
        {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
        <div className="row">
          <button type="button" onClick={() => navigate('/')}>Back</button>
          <button className="primary" type="submit" disabled={busy || !nickname.trim()}>
            {busy ? 'Setting up…' : "Let's go"}
          </button>
        </div>
      </form>
    </div>
  );
}
