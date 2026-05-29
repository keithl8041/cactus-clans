/**
 * WebSocket client for the versus-mode Durable Object lobby. Connects to
 * /api/versus/<code>/ws on the Cactus Clans Worker. The Worker hands the
 * upgrade off to a per-lobby `MatchLobby` DO that runs the authoritative
 * shared-balloon simulation at 20Hz.
 *
 * Dev story: without the Worker running, `vite dev` falls through to the
 * SPA assets and there is no /api/* handler — `connect` rejects up front so
 * the lobby page can render a "needs worker" message instead of leaving the
 * user staring at a silently broken WebSocket.
 */
import { usingRealBackend } from './api';

export interface VersusRosterEntry {
  id: string;
  nickname: string;
  clan: string;
  role: 'seat0' | 'seat1' | 'queue' | 'spectator';
}

export interface VersusPlayer {
  id: string;
  /** nickname */
  n: string;
  /** clan name */
  c: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** round hit count */
  h: number;
  /** facing left? */
  f: boolean;
}

export interface VersusSpike {
  /** render anchor x (texture origin, not collision centre) */
  x: number;
  y: number;
  o: 'up' | 'down' | 'left' | 'right';
}

export interface VersusState {
  t: 'state';
  tick: number;
  phase: 'waiting' | 'playing' | 'roundOver';
  /** True while the lobby has exactly one seated player bopping a respawning balloon. */
  practise: boolean;
  balloon: { x: number; y: number; vx: number; vy: number };
  seats: [string | null, string | null];
  queue: string[];
  players: VersusPlayer[];
  roster: VersusRosterEntry[];
  spikes: VersusSpike[];
  /** Total bops this round (shared, not per-player). */
  totalHits: number;
  /** Shared live score: totalHits * 10 + floor(elapsedMs/1000). */
  teamScore: number;
  /** Milliseconds elapsed in the current run (0 outside of `phase === 'playing'`). */
  elapsedMs: number;
  /** Best joint score this lobby session has hit so far (lives until DO restarts). */
  teamBest: { score: number; nicknames: string[] };
  endReason: string | null;
  roundOverIn: number;
  worldW: number;
  worldH: number;
}

export interface VersusWelcome {
  t: 'welcome';
  youId: string;
}

export interface VersusRoundEnd {
  t: 'roundEnd';
  reason: string;
  teamScore: number;
  teamHits: number;
  elapsedMs: number;
  newTeamBest: boolean;
  teamBest: { score: number; nicknames: string[] };
}

type ServerMsg = VersusState | VersusWelcome | VersusRoundEnd;

export interface VersusInput {
  l: boolean;
  r: boolean;
  /** true on the rising edge (a fresh tap/keypress). */
  j: boolean;
}

type VersusEvents = {
  welcome: VersusWelcome;
  state: VersusState;
  roundEnd: VersusRoundEnd;
  open: void;
  close: { code: number; reason: string };
  error: Error;
};

type Listener<T> = (payload: T) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyListener = Listener<any>;

export class VersusClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<keyof VersusEvents, Set<AnyListener>>();
  private closed = false;
  private myId: string | null = null;

  /** Stable id assigned by the server in the `welcome` message. */
  get id(): string | null {
    return this.myId;
  }

  on<K extends keyof VersusEvents>(event: K, fn: Listener<VersusEvents[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as AnyListener);
    return () => set!.delete(fn as AnyListener);
  }

  private emit<K extends keyof VersusEvents>(event: K, payload: VersusEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) (fn as Listener<VersusEvents[K]>)(payload);
  }

  /**
   * Open a connection to /api/versus/<code>/ws and announce nickname+clan.
   * Resolves on the first `welcome`; rejects on close/error before that.
   */
  connect(code: string, hello: { nickname: string; clan: string }): Promise<VersusWelcome> {
    if (!usingRealBackend) {
      return Promise.reject(
        new Error('Versus mode needs the Worker. Run `npm run worker:dev` and open http://localhost:8787/versus/...'),
      );
    }
    const cleaned = code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{1,32}$/.test(cleaned)) {
      return Promise.reject(new Error('Invalid lobby code'));
    }
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${scheme}://${window.location.host}/api/versus/${encodeURIComponent(cleaned)}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    this.closed = false;

    return new Promise<VersusWelcome>((resolve, reject) => {
      let resolved = false;
      ws.addEventListener('open', () => {
        this.emit('open', undefined);
        ws.send(JSON.stringify({ t: 'hello', nickname: hello.nickname, clan: hello.clan }));
      });
      ws.addEventListener('message', (ev) => {
        let msg: ServerMsg | null = null;
        try {
          msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '') as ServerMsg;
        } catch {
          return;
        }
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'welcome') {
          this.myId = msg.youId;
          this.emit('welcome', msg);
          if (!resolved) {
            resolved = true;
            resolve(msg);
          }
        } else if (msg.t === 'state') {
          this.emit('state', msg);
        } else if (msg.t === 'roundEnd') {
          this.emit('roundEnd', msg);
        }
      });
      ws.addEventListener('close', (ev) => {
        this.closed = true;
        this.emit('close', { code: ev.code, reason: ev.reason });
        if (!resolved) reject(new Error('WebSocket closed before welcome'));
      });
      ws.addEventListener('error', () => {
        this.emit('error', new Error('WebSocket error'));
        if (!resolved) reject(new Error('WebSocket error'));
      });
    });
  }

  sendInput(input: VersusInput): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ t: 'input', l: input.l, r: input.r, j: input.j }));
  }

  leaveSeat(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ t: 'leaveSeat' }));
  }

  disconnect(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    this.ws = null;
  }
}
