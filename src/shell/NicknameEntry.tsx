import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkNickname, signInWithNickname } from '../services/session';
import { syncActiveRunFromServer } from '../services/progress';
import { useGameStore } from '../store/gameStore';
import { consumeReturnTo } from './postAuthReturn';

type Step =
  | { kind: 'enterName' }
  | { kind: 'newPlayer'; nickname: string }
  | { kind: 'existingPlayer'; nickname: string; suggestions: string[] };

export function NicknameEntry() {
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'enterName' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const setPlayer = useGameStore((s) => s.setPlayer);
  const setRun = useGameStore((s) => s.setRun);

  const pinValid = /^\d{4}$/.test(pin);

  async function runNicknameCheck(name: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await checkNickname(name);
      if (result.exists) {
        setStep({ kind: 'existingPlayer', nickname: name.trim(), suggestions: result.suggestions });
      } else {
        setStep({ kind: 'newPlayer', nickname: name.trim() });
      }
      setPin('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function submitNickname(e: React.FormEvent) {
    e.preventDefault();
    await runNicknameCheck(nickname);
  }

  async function pickSuggestion(suggested: string) {
    setNickname(suggested);
    await runNicknameCheck(suggested);
  }

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind === 'enterName') return;
    setBusy(true);
    setError(null);
    try {
      const session = await signInWithNickname(step.nickname, pin);
      setPlayer(session);
      // Hydrate from the server so logging in on a new device picks up the
      // player's latest in-progress run instead of starting fresh.
      const run = await syncActiveRunFromServer(session.id);
      setRun(run ?? null);
      const returnTo = consumeReturnTo();
      navigate(returnTo ?? (run ? '/journey' : '/clans'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function backToNameEntry() {
    setStep({ kind: 'enterName' });
    setPin('');
    setError(null);
  }

  if (step.kind === 'enterName') {
    return (
      <div className="screen">
        <h1>Start or resume</h1>
        <h2 style={{ maxWidth: '28rem', textAlign: 'center', fontWeight: 'normal', opacity: 0.85 }}>
          Pick a nickname. If it's already taken, you can log in with your PIN or choose a different one.
        </h2>
        <form onSubmit={submitNickname} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            autoFocus
            value={nickname}
            maxLength={24}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname (e.g. SpikyJoe)"
          />
          {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
          <div className="row">
            <button type="button" onClick={() => navigate('/', { state: { pickPlayer: true } })}>Back</button>
            <button className="primary" type="submit" disabled={busy || !nickname.trim()}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step.kind === 'newPlayer') {
    return (
      <div className="screen">
        <h1>Welcome, {step.nickname}!</h1>
        <h2 style={{ maxWidth: '28rem', textAlign: 'center', fontWeight: 'normal', opacity: 0.85 }}>
          That nickname is yours. Pick a 4-digit PIN so you can resume your run on any device.
        </h2>
        <form onSubmit={submitPin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoFocus
            value={pin}
            maxLength={4}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="4-digit PIN"
            style={{ textAlign: 'center', letterSpacing: '0.4em' }}
          />
          {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
          <div className="row">
            <button type="button" onClick={backToNameEntry}>Back</button>
            <button className="primary" type="submit" disabled={busy || !pinValid}>
              {busy ? 'Creating…' : 'Create player'}
            </button>
          </div>
        </form>
        <p style={{ maxWidth: '28rem', textAlign: 'center', fontSize: '0.8rem', opacity: 0.6, marginTop: '1.5rem' }}>
          We use anonymised event tracking to understand how the game is played. We don't collect
          personal information.
        </p>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>"{step.nickname}" is taken</h1>
      <h2 style={{ maxWidth: '28rem', textAlign: 'center', fontWeight: 'normal', opacity: 0.85 }}>
        If this is your player, enter your PIN to log in. Otherwise, pick a different nickname.
      </h2>
      <form onSubmit={submitPin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus
          value={pin}
          maxLength={4}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4-digit PIN"
          style={{ textAlign: 'center', letterSpacing: '0.4em' }}
        />
        {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
        <div className="row">
          <button type="button" onClick={backToNameEntry}>Pick another</button>
          <button className="primary" type="submit" disabled={busy || !pinValid}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </div>
      </form>
      {step.suggestions.length > 0 && (
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ opacity: 0.7 }}>Or try one of these:</div>
          <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {step.suggestions.map((s) => (
              <button key={s} type="button" onClick={() => pickSuggestion(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
