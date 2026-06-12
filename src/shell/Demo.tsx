import { useEffect, useRef, useState } from 'react';
import { checkNickname, signInWithNickname } from '../services/session';
import type { PlayerSession } from '../services/session';
import { CLANS } from '../data/clans';
import {
  fetchDemoLeaderboard,
  submitDemoScore,
  type DemoLeaderboardEntry,
} from '../services/leaderboard';
import { DemoGame } from './DemoGame';
import { enterFullscreen } from './fullscreen';
import { IosInstallHint } from './IosInstallHint';

/**
 * The clan used for all demo players. Named explicitly rather than relying on
 * CLANS[0] so this stays stable if the display order ever changes.
 */
const DEMO_CLAN_NAME = 'Prickling Clan';
const DEMO_CLAN = CLANS.find((c) => c.name === DEMO_CLAN_NAME) ?? CLANS[0];
const DEMO_LEVEL_NUMBER = 6;

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type DemoStep =
  | { kind: 'register' }
  | { kind: 'play'; player: PlayerSession }
  | { kind: 'leaderboard'; player: PlayerSession; score: number };

// ---------------------------------------------------------------------------
// Main Demo component
// ---------------------------------------------------------------------------

/**
 * Standalone demo experience at `/demo`.
 *
 * Loop: register (nickname + PIN) → play Level 6 once → JKPS Summer Fair
 * leaderboard → "Next player" resets to registration.
 *
 * This component is lazy-loaded from App.tsx. It directly imports DemoGame
 * (which brings in Phaser), so both land in the same lazy chunk and Phaser
 * never enters the main bundle.
 */
export function Demo() {
  const [step, setStep] = useState<DemoStep>({ kind: 'register' });

  // Swap in the demo-specific PWA manifest so "Add to Home Screen" on iOS
  // launches the app full-screen directly at /demo, not /game.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const titleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const prevHref = link?.href ?? null;
    const prevTitle = titleMeta?.content ?? null;
    if (link) link.href = '/manifest-demo.webmanifest';
    if (titleMeta) titleMeta.content = 'Cactus Clans Demo';
    return () => {
      if (link && prevHref) link.href = prevHref;
      if (titleMeta && prevTitle) titleMeta.content = prevTitle;
    };
  }, []);

  function handleRegistered(player: PlayerSession) {
    setStep({ kind: 'play', player });
  }

  function handleGameComplete(player: PlayerSession, score: number) {
    void submitDemoScore({ nickname: player.nickname, score });
    setStep({ kind: 'leaderboard', player, score });
  }

  function handleNextPlayer() {
    setStep({ kind: 'register' });
  }

  if (step.kind === 'register') {
    return <DemoRegister onSuccess={handleRegistered} />;
  }

  if (step.kind === 'play') {
    const { player } = step;
    return (
      <DemoGame
        player={player}
        clan={DEMO_CLAN}
        levelNumber={DEMO_LEVEL_NUMBER}
        onComplete={(score) => handleGameComplete(player, score)}
        onAbort={handleNextPlayer}
      />
    );
  }

  return (
    <DemoLeaderboard
      currentNickname={step.player.nickname}
      currentScore={step.score}
      onNextPlayer={handleNextPlayer}
    />
  );
}

// ---------------------------------------------------------------------------
// Registration sub-component
// ---------------------------------------------------------------------------

type RegStep =
  | { kind: 'enterName' }
  | { kind: 'newPlayer'; nickname: string }
  | { kind: 'existingPlayer'; nickname: string; suggestions: string[] };

function DemoRegister({ onSuccess }: { onSuccess: (player: PlayerSession) => void }) {
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [regStep, setRegStep] = useState<RegStep>({ kind: 'enterName' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pinValid = /^\d{4}$/.test(pin);

  async function runNicknameCheck(name: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await checkNickname(name);
      if (result.exists) {
        setRegStep({ kind: 'existingPlayer', nickname: name.trim(), suggestions: result.suggestions });
      } else {
        setRegStep({ kind: 'newPlayer', nickname: name.trim() });
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
    void enterFullscreen();
    await runNicknameCheck(nickname);
  }

  async function pickSuggestion(suggested: string) {
    setNickname(suggested);
    await runNicknameCheck(suggested);
  }

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (regStep.kind === 'enterName') return;
    void enterFullscreen();
    setBusy(true);
    setError(null);
    try {
      const session = await signInWithNickname(regStep.nickname, pin);
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function backToNameEntry() {
    setRegStep({ kind: 'enterName' });
    setPin('');
    setError(null);
  }

  if (regStep.kind === 'enterName') {
    return (
      <div className="screen">
        <h1>🌵 JKPS Summer Fair</h1>
        <h2 style={{ maxWidth: '28rem', textAlign: 'center', fontWeight: 'normal', opacity: 0.85 }}>
          Pick a nickname to play Cactus Dart Toss and get on the leaderboard!
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
          <button className="primary" type="submit" disabled={busy || !nickname.trim()}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
        </form>
        <div style={{ marginTop: '1.5rem' }}>
          <IosInstallHint storageKey="cactus-clans:demo-ios-hint" />
        </div>
      </div>
    );
  }

  if (regStep.kind === 'newPlayer') {
    return (
      <div className="screen">
        <h1>Welcome, {regStep.nickname}!</h1>
        <h2 style={{ maxWidth: '28rem', textAlign: 'center', fontWeight: 'normal', opacity: 0.85 }}>
          That nickname is yours. Pick a 4-digit PIN so you can retrieve your score later.
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
              {busy ? 'Creating…' : 'Play!'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>"{regStep.nickname}" is taken</h1>
      <h2 style={{ maxWidth: '28rem', textAlign: 'center', fontWeight: 'normal', opacity: 0.85 }}>
        If this is you, enter your PIN to play. Otherwise, pick a different nickname.
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
            {busy ? 'Logging in…' : 'Play!'}
          </button>
        </div>
      </form>
      {regStep.suggestions.length > 0 && (
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ opacity: 0.7 }}>Or try one of these:</div>
          <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {regStep.suggestions.map((s) => (
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

// ---------------------------------------------------------------------------
// Demo leaderboard sub-component
// ---------------------------------------------------------------------------

function DemoLeaderboard({
  currentNickname,
  currentScore,
  onNextPlayer,
}: {
  currentNickname: string;
  currentScore: number;
  onNextPlayer: () => void;
}) {
  const [entries, setEntries] = useState<DemoLeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await fetchDemoLeaderboard();
        setEntries(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      }
    })();
  }, []);

  // Scroll the player's own row into view once the list loads.
  useEffect(() => {
    if (!entries || !listRef.current) return;
    const meRow = listRef.current.querySelector('.me');
    meRow?.scrollIntoView({ block: 'nearest' });
  }, [entries]);

  return (
    <div className="screen">
      <h1>🌵 JKPS Summer Fair</h1>
      <h2 style={{ margin: '0 0 0.5rem' }}>Cactus Dart Toss · Leaderboard</h2>
      <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' }}>
        Your score: {currentScore}
      </div>
      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      {entries == null ? (
        <div>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={{ color: 'var(--text-dim)' }}>No scores yet — yours is the first!</div>
      ) : (
        <div className="leaderboard-list" ref={listRef}>
          {entries.map((e, i) => (
            <div
              key={e.nickname}
              className={`leaderboard-row${e.nickname === currentNickname ? ' me' : ''}`}
            >
              <span className="rank">#{i + 1}</span>
              <span><strong>{e.nickname}</strong></span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{e.score}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: '1.5rem' }}>
        <button className="primary" onClick={onNextPlayer} autoFocus>
          Next player →
        </button>
      </div>
    </div>
  );
}
