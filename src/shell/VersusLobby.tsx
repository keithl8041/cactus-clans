import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Phaser from 'phaser';
import { useGameStore } from '../store/gameStore';
import { CLANS } from '../data/clans';
import { usingRealBackend } from '../services/api';
import { VersusClient, type VersusRosterEntry, type VersusState } from '../services/versus';
import { VersusBalloonScene } from '../multiplayer/VersusBalloonScene';
import { RotateOverlay } from './RotateOverlay';
import { useNeedsRotate } from './useNeedsRotate';

/**
 * Easter-egg multiplayer lobby. Two players bop a shared balloon; the rest
 * queue/spectate. Server-authoritative physics live in the `MatchLobby`
 * Durable Object — this page is the client renderer + lobby presence UI.
 *
 * Routed as `/versus/:code`. Anyone with the code joins the same DO instance.
 */
export function VersusLobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const player = useGameStore((s) => s.player);
  const run = useGameStore((s) => s.run);
  const needsRotate = useNeedsRotate();

  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const clientRef = useRef<VersusClient | null>(null);

  const [state, setState] = useState<VersusState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const cleanedCode = (code ?? '').trim().toUpperCase();
  const clanName = run?.clan ?? CLANS[0]?.name ?? 'Prickling Clan';

  useEffect(() => {
    if (!player) {
      navigate(`/?return=${encodeURIComponent(`/versus/${cleanedCode}`)}`);
      return;
    }
    if (!cleanedCode || !/^[A-Z0-9-]{1,32}$/.test(cleanedCode)) {
      setError('That lobby code has weird characters. Try letters/digits only.');
      return;
    }

    const client = new VersusClient();
    clientRef.current = client;

    const offState = client.on('state', (s) => setState(s));
    const offClose = client.on('close', (info) =>
      setError(`Lobby connection closed${info.reason ? ` — ${info.reason}` : '.'}`),
    );

    client
      .connect(cleanedCode, { nickname: player.nickname, clan: clanName })
      .then(() => setConnected(true))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));

    // Mount Phaser only after we've kicked off the connection. The scene
    // wires its own subscription to state updates via the shared client.
    const scene = new VersusBalloonScene({ client });
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current!,
      backgroundColor: '#16291c',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
      },
      scene,
    });
    gameRef.current = game;

    return () => {
      offState();
      offClose();
      client.disconnect();
      clientRef.current = null;
      game.destroy(true);
      gameRef.current = null;
    };
    // Intentionally re-run only on code/player change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanedCode, player?.id]);

  // Pause Phaser while we're in landscape-required limbo, mirroring GameContainer.
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (needsRotate) game.scene.scenes.forEach((s) => s.scene.pause());
    else game.scene.scenes.forEach((s) => s.scene.resume());
  }, [needsRotate]);

  if (!usingRealBackend) {
    return (
      <div className="screen">
        <h1>Versus Mode</h1>
        <h2 style={{ color: 'var(--accent-warm)' }}>Needs the Worker</h2>
        <p style={{ maxWidth: '28rem', textAlign: 'center' }}>
          Versus mode connects to a Cloudflare Worker over WebSocket. Run
          <code style={{ margin: '0 0.4em' }}>npm run worker:dev</code>
          and open <code>http://localhost:8787/versus/{cleanedCode || 'YOURCODE'}</code> instead.
        </p>
        <button onClick={() => navigate('/')}>Back</button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="screen">
        <h1>Versus Mode</h1>
        <h2 style={{ color: 'var(--danger)' }}>{error}</h2>
        <button onClick={() => navigate('/')}>Back</button>
      </div>
    );
  }

  const youId = clientRef.current?.id ?? null;
  return (
    <div className="game-canvas-wrap">
      <div className="hud">
        <span className="pill">Lobby {cleanedCode}</span>
        <span className="pill">{state?.phase ?? (connected ? 'connecting…' : '…')}</span>
        <button onClick={() => navigate('/')} style={{ marginLeft: 'auto' }}>Leave</button>
      </div>
      <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
      <RotateOverlay active={needsRotate} />
      <VersusSidebar state={state} youId={youId} />
    </div>
  );
}

function VersusSidebar({ state, youId }: { state: VersusState | null; youId: string | null }) {
  if (!state) return null;
  const seat0 = state.roster.find((r) => r.id === state.seats[0]);
  const seat1 = state.roster.find((r) => r.id === state.seats[1]);
  const queue = state.roster.filter((r) => r.role === 'queue');
  const spectators = state.roster.filter((r) => r.role === 'spectator');
  return (
    <div
      style={{
        position: 'absolute',
        top: 64,
        right: 16,
        background: 'rgba(15, 26, 16, 0.78)',
        color: '#fff5b7',
        padding: '10px 14px',
        borderRadius: 8,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        minWidth: 180,
        maxWidth: 260,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 700, color: '#f7c948', marginBottom: 4 }}>Seats</div>
      <SeatLine label="P1" entry={seat0} youId={youId} />
      <SeatLine label="P2" entry={seat1} youId={youId} />
      {queue.length > 0 && (
        <>
          <div style={{ fontWeight: 700, color: '#f7c948', marginTop: 8, marginBottom: 4 }}>Queue</div>
          {queue.map((r) => (
            <div key={r.id}>
              {r.nickname}
              {r.id === youId ? ' (you)' : ''}
            </div>
          ))}
        </>
      )}
      {spectators.length > 0 && (
        <>
          <div style={{ fontWeight: 700, color: '#f7c948', marginTop: 8, marginBottom: 4 }}>
            Spectators ({spectators.length})
          </div>
        </>
      )}
    </div>
  );
}

function SeatLine({ label, entry, youId }: { label: string; entry: VersusRosterEntry | undefined; youId: string | null }) {
  return (
    <div>
      <span style={{ color: '#a3d977' }}>{label}: </span>
      <span>
        {entry ? `${entry.nickname}${entry.id === youId ? ' (you)' : ''}` : <em style={{ color: '#888' }}>empty</em>}
      </span>
    </div>
  );
}
