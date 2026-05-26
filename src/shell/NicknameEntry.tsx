import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithNickname } from '../services/session';
import { getActiveRun } from '../services/progress';
import { useGameStore } from '../store/gameStore';

export function NicknameEntry() {
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const setPlayer = useGameStore((s) => s.setPlayer);
  const setRun = useGameStore((s) => s.setRun);

  const pinValid = /^\d{4}$/.test(pin);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await signInWithNickname(nickname, pin);
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
      <h1>Start or resume</h1>
      <h2 style={{ maxWidth: '28rem', textAlign: 'center', fontWeight: 'normal', opacity: 0.85 }}>
        New player? Pick a nickname and a 4-digit PIN — they'll let you pick up where you left off on any device.
        <br />
        Already played somewhere else? Enter the same nickname and PIN to resume your run here.
      </h2>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <input
          type="text"
          autoFocus
          value={nickname}
          maxLength={24}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Nickname (e.g. SpikyJoe)"
        />
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={pin}
          maxLength={4}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4-digit PIN"
          style={{ textAlign: 'center', letterSpacing: '0.4em' }}
        />
        {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
        <div className="row">
          <button type="button" onClick={() => navigate('/', { state: { pickPlayer: true } })}>Back</button>
          <button className="primary" type="submit" disabled={busy || !nickname.trim() || !pinValid}>
            {busy ? 'Checking…' : 'Start / resume'}
          </button>
        </div>
      </form>
    </div>
  );
}
