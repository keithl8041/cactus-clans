import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithNickname } from '../services/session';
import { useGameStore } from '../store/gameStore';

export function NicknameEntry() {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const setPlayer = useGameStore((s) => s.setPlayer);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await signInWithNickname(nickname);
      setPlayer(session);
      navigate('/clans');
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
        <button className="primary" type="submit" disabled={busy || !nickname.trim()}>
          {busy ? 'Setting up…' : "Let's go"}
        </button>
      </form>
    </div>
  );
}
