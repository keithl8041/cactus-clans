/// <reference types="@cloudflare/workers-types" />
// Plain-class DO (no `extends DurableObject`) — avoids a runtime bundling
// glitch where the `cloudflare:workers` import resolved to undefined and
// the class extension blew up at load time. We don't need any of the base
// class's helpers; `state` + `env` in the constructor is enough.

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

// Logical world matches GameContainer's 1280x720 canvas.
const WORLD_W = 1280;
const WORLD_H = 720;

// Physics constants — mirror src/levels/01-balloon-keepy-uppy/config.ts.
// Worker code can't import from src/, so these are duplicated by design.
const C = {
  baseGravity: 700,
  balloonGravityY: 240,
  maxFallSpeed: 600,
  balloonSize: 96,
  balloonMaxVX: 400,
  balloonDragX: 20,
  balloonWallBounce: 0.85,

  playerSize: 96,
  playerMaxSpeed: 360,
  playerMaxFallSpeed: 800,
  playerJumpImpulse: -520,
  playerGroundDrag: 1200,

  balloonMaxBounceVX: 280,
  balloonBounceVY: -360,
  jumpBounceBoostThreshold: 60,
  jumpBounceBonusVY: -180,
  hitCooldownMs: 250,

  cactusSize: 80,
  floorPadding: 60,
  groundLineOffset: 30,
  playerSink: 8,

  // Wall hazard: a single cactus pokes out of one side wall at a random
  // height, alternating sides between appearances with a brief empty gap.
  // Punt the balloon into it and the run ends.
  wallPadding: 16,
  wallSpikeMinFrac: 0.20,    // random Y range (fraction of WORLD_H)
  wallSpikeMaxFrac: 0.85,
  wallSpikePresentMs: 3500,  // how long each spike lingers
  wallSpikeAbsentMs: 2000,   // gap before the next one appears on the other side

  roundOverHoldMs: 3000,
} as const;

const GROUND_Y = WORLD_H - C.floorPadding + C.groundLineOffset + C.playerSink;
const FLOOR_LINE_Y = WORLD_H - C.floorPadding + C.groundLineOffset; // top of sandy strip's cactus row
const TICK_MS = 50; // 20Hz

// Player body matches Phaser body: 0.6 width × 0.85 height of the 96px sprite.
const PLAYER_HALF_W = (C.playerSize * 0.6) / 2;
const PLAYER_HALF_H = (C.playerSize * 0.85) / 2;
// Balloon body is 0.85 of its 96px sprite.
const BALLOON_HALF_W = (C.balloonSize * 0.85) / 2;
const BALLOON_HALF_H = (C.balloonSize * 0.85) / 2;

type Orientation = 'up' | 'down' | 'left' | 'right';
type Phase = 'waiting' | 'playing' | 'roundOver';

interface Spike {
  x: number; // collision AABB centre
  y: number;
  w: number; // half-width
  h: number; // half-height
  o: Orientation; // orientation for client rendering
  rx: number; // render anchor x (texture origin)
  ry: number; // render anchor y
}

interface PlayerState {
  id: string;
  nickname: string;
  clan: string;
  // Inputs (latest from client)
  leftHeld: boolean;
  rightHeld: boolean;
  jumpQueued: boolean;
  // Physics
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facingLeft: boolean;
  // Round scoring
  hits: number;
  lastHitAt: number;
}

interface LobbyState {
  phase: Phase;
  tick: number;
  balloon: { x: number; y: number; vx: number; vy: number };
  players: Map<string, PlayerState>;
  seats: [string | null, string | null];
  queue: string[]; // additional players waiting for a seat
  spectatorOnly: Set<string>; // clients who haven't said 'hello' yet
  spikes: Spike[];
  totalHits: number;
  roundStartedAt: number; // server epoch ms — used to compute elapsedMs for the shared score
  roundOverAt: number;    // server epoch ms when roundOver should auto-advance
  endReason: string | null;
  // Cooperative scoring. teamBest is the lobby-wide high score this session
  // (lives until the DO restarts). Both fields wipe on initialState().
  teamBest: { score: number; nicknames: string[] };
  // Wall-spike cycle: one spike at a time, alternating sides.
  wallSpikePresent: boolean;
  wallSpikeSide: 'left' | 'right'; // current side if present, next side if absent
  wallSpikeChangeAt: number;       // server time ms — when to flip present↔absent
}

interface SocketEntry {
  id: string;
  socket: WebSocket;
  nickname: string;
  clan: string;
  helloed: boolean;
}

export class MatchLobby implements DurableObject {
  private sockets = new Map<string, SocketEntry>();
  private state: LobbyState = MatchLobby.initialState();
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;

  constructor(_ctx: DurableObjectState, _env: Env) {
    // No persisted state — lobbies are ephemeral. ctx/env retained for future use.
  }

  static initialState(): LobbyState {
    return {
      phase: 'waiting',
      tick: 0,
      balloon: { x: WORLD_W / 2, y: WORLD_H * 0.3, vx: 0, vy: 0 },
      players: new Map(),
      seats: [null, null],
      queue: [],
      spectatorOnly: new Set(),
      spikes: [],
      totalHits: 0,
      roundStartedAt: 0,
      roundOverAt: 0,
      endReason: null,
      teamBest: { score: 0, nicknames: [] },
      wallSpikePresent: false,
      wallSpikeSide: Math.random() < 0.5 ? 'left' : 'right',
      wallSpikeChangeAt: 0,
    };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 400 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const id = crypto.randomUUID();
    const entry: SocketEntry = { id, socket: server, nickname: '', clan: '', helloed: false };
    this.sockets.set(id, entry);
    this.state.spectatorOnly.add(id);

    server.addEventListener('message', (ev) => {
      try {
        const raw = typeof ev.data === 'string' ? ev.data : '';
        if (!raw) return;
        const msg = JSON.parse(raw);
        this.onMessage(id, msg);
      } catch {
        // ignore malformed
      }
    });
    server.addEventListener('close', () => this.onDisconnect(id));
    server.addEventListener('error', () => this.onDisconnect(id));

    this.sendTo(id, { t: 'welcome', youId: id });
    this.broadcastSnapshot();
    this.startTickIfNeeded();

    return new Response(null, { status: 101, webSocket: client });
  }

  // -------- Connection / role assignment --------

  private onMessage(id: string, msg: unknown): void {
    if (!msg || typeof msg !== 'object') return;
    const m = msg as { t?: string; nickname?: unknown; clan?: unknown; l?: unknown; r?: unknown; j?: unknown };
    if (m.t === 'hello') {
      const nickname = String(m.nickname ?? 'guest').slice(0, 24) || 'guest';
      const clan = String(m.clan ?? 'Prickling Clan').slice(0, 32) || 'Prickling Clan';
      this.handleHello(id, nickname, clan);
      return;
    }
    if (m.t === 'input') {
      const p = this.state.players.get(id);
      if (!p) return;
      p.leftHeld = !!m.l;
      p.rightHeld = !!m.r;
      if (m.j) p.jumpQueued = true;
      return;
    }
    if (m.t === 'leaveSeat') {
      this.bumpToQueueTail(id);
      this.broadcastSnapshot();
      return;
    }
  }

  private handleHello(id: string, nickname: string, clan: string): void {
    const sock = this.sockets.get(id);
    if (!sock) return;
    sock.nickname = nickname;
    sock.clan = clan;
    sock.helloed = true;
    this.state.spectatorOnly.delete(id);

    // Promote to a free seat, else queue.
    const seat = this.state.seats.indexOf(null);
    if (seat !== -1) {
      this.state.seats[seat] = id;
    } else if (!this.state.queue.includes(id) && !this.state.seats.includes(id)) {
      this.state.queue.push(id);
    }
    this.spawnPlayerStateIfMissing(id, nickname, clan);
    this.maybeStartRound();
    this.broadcastSnapshot();
  }

  private spawnPlayerStateIfMissing(id: string, nickname: string, clan: string): void {
    if (this.state.players.has(id)) {
      const p = this.state.players.get(id)!;
      p.nickname = nickname;
      p.clan = clan;
      return;
    }
    this.state.players.set(id, {
      id,
      nickname,
      clan,
      leftHeld: false,
      rightHeld: false,
      jumpQueued: false,
      x: WORLD_W / 2,
      y: GROUND_Y - PLAYER_HALF_H,
      vx: 0,
      vy: 0,
      onGround: true,
      facingLeft: false,
      hits: 0,
      lastHitAt: 0,
    });
  }

  private onDisconnect(id: string): void {
    this.sockets.delete(id);
    this.state.spectatorOnly.delete(id);
    const seatIdx = this.state.seats.indexOf(id);
    if (seatIdx !== -1) {
      this.state.seats[seatIdx] = null;
      // Mid-match drop → end the shared run with a friendly reason.
      if (this.state.phase === 'playing') {
        this.endRunTogether('a friend disconnected');
      }
    }
    const qIdx = this.state.queue.indexOf(id);
    if (qIdx !== -1) this.state.queue.splice(qIdx, 1);
    this.state.players.delete(id);

    if (this.sockets.size === 0) {
      this.stopTick();
      // Reset state. Next visitor gets a fresh lobby.
      this.state = MatchLobby.initialState();
      return;
    }
    // Try to backfill from the queue if the lobby is mid-rotation.
    if (this.state.phase !== 'playing') {
      this.promoteFromQueue();
      this.maybeStartRound();
    }
    this.broadcastSnapshot();
  }

  private bumpToQueueTail(id: string): void {
    const seatIdx = this.state.seats.indexOf(id);
    if (seatIdx === -1) return;
    this.state.seats[seatIdx] = null;
    if (this.state.phase === 'playing') {
      this.endRunTogether('a friend left the seat');
    }
    if (!this.state.queue.includes(id)) this.state.queue.push(id);
    if (this.state.phase !== 'playing') {
      this.promoteFromQueue();
      this.maybeStartRound();
    }
  }

  private promoteFromQueue(): void {
    for (let i = 0; i < this.state.seats.length; i++) {
      if (this.state.seats[i] != null) continue;
      const next = this.state.queue.shift();
      if (!next) return;
      this.state.seats[i] = next;
    }
  }

  // -------- Round lifecycle --------

  private maybeStartRound(): void {
    if (this.state.phase === 'playing') return;
    if (this.state.seats[0] != null && this.state.seats[1] != null) {
      this.startRound();
      return;
    }
    this.state.phase = 'waiting';
    // Practise mode: if exactly one seat is filled, set up the world so the
    // lone player can bop a balloon around while they wait. Floor cacti come
    // along for the ride; difficulty wall-spikes still ramp normally and reset
    // whenever the balloon respawns.
    const seatedCount = (this.state.seats[0] ? 1 : 0) + (this.state.seats[1] ? 1 : 0);
    if (seatedCount === 1) {
      this.setupPractice();
    } else {
      // Empty lobby of seats — clear practice world.
      this.state.spikes = [];
      this.state.totalHits = 0;
      this.state.balloon = { x: WORLD_W / 2, y: WORLD_H * 0.3, vx: 0, vy: 0 };
    }
  }

  private setupPractice(): void {
    this.state.spikes = [];
    this.state.totalHits = 0;
    this.addCactus(WORLD_W * 0.18, FLOOR_LINE_Y, 'up');
    this.addCactus(WORLD_W * 0.82, FLOOR_LINE_Y, 'up');
    this.resetWallSpike();
    this.state.balloon = { x: WORLD_W / 2, y: WORLD_H * 0.3, vx: 0, vy: 0 };
    // Center the solo player and reset their state so respawns feel clean.
    const seatId = this.state.seats[0] ?? this.state.seats[1];
    if (!seatId) return;
    const p = this.state.players.get(seatId);
    if (!p) return;
    p.x = WORLD_W / 2;
    p.y = GROUND_Y - PLAYER_HALF_H;
    p.vx = 0;
    p.vy = 0;
    p.onGround = true;
    p.hits = 0;
    p.lastHitAt = 0;
  }

  private respawnBalloonForPractice(): void {
    // Soft reset — fresh balloon and spike layout, but don't yank the player
    // around mid-stride.
    this.state.spikes = [];
    this.state.totalHits = 0;
    this.addCactus(WORLD_W * 0.18, FLOOR_LINE_Y, 'up');
    this.addCactus(WORLD_W * 0.82, FLOOR_LINE_Y, 'up');
    this.resetWallSpike();
    this.state.balloon = { x: WORLD_W / 2, y: WORLD_H * 0.3, vx: 0, vy: 0 };
  }

  private startRound(): void {
    // Reset balloon, players, spikes, scores.
    this.state.balloon = { x: WORLD_W / 2, y: WORLD_H * 0.3, vx: 0, vy: 0 };
    this.state.totalHits = 0;
    this.state.endReason = null;
    this.state.roundStartedAt = Date.now();
    this.state.spikes = [];
    // Floor cacti — same positions as single-player.
    this.addCactus(WORLD_W * 0.18, FLOOR_LINE_Y, 'up');
    this.addCactus(WORLD_W * 0.82, FLOOR_LINE_Y, 'up');
    this.resetWallSpike();

    const seat0Id = this.state.seats[0]!;
    const seat1Id = this.state.seats[1]!;
    const seat0 = this.state.players.get(seat0Id)!;
    const seat1 = this.state.players.get(seat1Id)!;
    seat0.x = WORLD_W * 0.25;
    seat1.x = WORLD_W * 0.75;
    for (const p of [seat0, seat1]) {
      p.y = GROUND_Y - PLAYER_HALF_H;
      p.vx = 0;
      p.vy = 0;
      p.onGround = true;
      p.facingLeft = false;
      p.hits = 0;
      p.lastHitAt = 0;
      p.leftHeld = false;
      p.rightHeld = false;
      p.jumpQueued = false;
    }
    this.state.phase = 'playing';
  }

  private endRunTogether(reason: string): void {
    if (this.state.phase !== 'playing') return;
    this.state.phase = 'roundOver';
    this.state.endReason = reason;
    this.state.roundOverAt = Date.now() + C.roundOverHoldMs;

    const elapsedMs = Math.max(0, Date.now() - this.state.roundStartedAt);
    const teamHits = this.state.totalHits;
    const teamScore = teamHits * 10 + Math.floor(elapsedMs / 1000);
    const newTeamBest = teamScore > this.state.teamBest.score;
    if (newTeamBest) {
      const nicks: string[] = [];
      for (const seatId of this.state.seats) {
        if (!seatId) continue;
        const p = this.state.players.get(seatId);
        if (p) nicks.push(p.nickname);
      }
      this.state.teamBest = { score: teamScore, nicknames: nicks };
    }

    this.broadcastEvent({
      t: 'roundEnd',
      reason,
      teamScore,
      teamHits,
      elapsedMs,
      newTeamBest,
      teamBest: this.state.teamBest,
    });
  }

  /**
   * Cooperative rotation: at round end, push both seats to the back of the
   * queue and refill from the front. With an empty queue, the same pair plays
   * again. With 1+ waiters, fresh players cycle in (everyone gets a turn).
   */
  private rotateSeatsAfterRound(): void {
    const old0 = this.state.seats[0];
    const old1 = this.state.seats[1];
    this.state.seats[0] = null;
    this.state.seats[1] = null;
    if (old0 && this.sockets.has(old0) && !this.state.queue.includes(old0)) {
      this.state.queue.push(old0);
    } else if (old0 && !this.sockets.has(old0)) {
      this.state.players.delete(old0);
    }
    if (old1 && this.sockets.has(old1) && !this.state.queue.includes(old1)) {
      this.state.queue.push(old1);
    } else if (old1 && !this.sockets.has(old1)) {
      this.state.players.delete(old1);
    }
    this.promoteFromQueue();
    this.maybeStartRound();
  }

  // -------- Tick loop --------

  private startTickIfNeeded(): void {
    if (this.tickHandle) return;
    this.lastTickAt = Date.now();
    this.tickHandle = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTick(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = null;
  }

  private tick(): void {
    const now = Date.now();
    const dt = Math.min(0.1, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;
    this.state.tick += 1;

    if (this.state.phase === 'playing') {
      this.updateWallSpike(now);
      this.simulatePhysics(dt, now);
    } else if (this.state.phase === 'waiting' && this.isPracticeActive()) {
      // Solo practise — same physics, but a drop respawns the balloon
      // instead of ending a round.
      this.updateWallSpike(now);
      this.simulatePhysics(dt, now);
    } else if (this.state.phase === 'roundOver' && now >= this.state.roundOverAt) {
      this.rotateSeatsAfterRound();
    }

    this.broadcastSnapshot();
  }

  private isPracticeActive(): boolean {
    const seatedCount = (this.state.seats[0] ? 1 : 0) + (this.state.seats[1] ? 1 : 0);
    return seatedCount === 1;
  }

  // -------- Physics --------

  private simulatePhysics(dt: number, now: number): void {
    // Step seated players. Spectators/queue players are not simulated.
    for (const seatId of this.state.seats) {
      if (!seatId) continue;
      const p = this.state.players.get(seatId);
      if (!p) continue;
      this.stepPlayer(p, dt);
    }
    this.stepBalloon(dt);
    this.resolveCollisions(now);
  }

  private stepPlayer(p: PlayerState, dt: number): void {
    // Jump first (uses prior onGround).
    if (p.jumpQueued && p.onGround) {
      p.vy = C.playerJumpImpulse;
      p.onGround = false;
    }
    p.jumpQueued = false;

    // Horizontal intent.
    if (p.leftHeld && !p.rightHeld) {
      p.vx = -C.playerMaxSpeed;
      p.facingLeft = true;
    } else if (p.rightHeld && !p.leftHeld) {
      p.vx = C.playerMaxSpeed;
      p.facingLeft = false;
    } else if (p.onGround) {
      // Ground drag — decelerate toward zero.
      const drag = C.playerGroundDrag * dt;
      if (Math.abs(p.vx) <= drag) p.vx = 0;
      else p.vx -= Math.sign(p.vx) * drag;
    }

    // Gravity.
    p.vy += C.baseGravity * dt;
    if (p.vy > C.playerMaxFallSpeed) p.vy = C.playerMaxFallSpeed;

    // Integrate.
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // World bounds (horizontal).
    if (p.x - PLAYER_HALF_W < 0) {
      p.x = PLAYER_HALF_W;
      if (p.vx < 0) p.vx = 0;
    } else if (p.x + PLAYER_HALF_W > WORLD_W) {
      p.x = WORLD_W - PLAYER_HALF_W;
      if (p.vx > 0) p.vx = 0;
    }

    // Floor.
    const footY = p.y + PLAYER_HALF_H;
    if (footY >= GROUND_Y) {
      p.y = GROUND_Y - PLAYER_HALF_H;
      if (p.vy > 0) p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }
  }

  private stepBalloon(dt: number): void {
    const b = this.state.balloon;
    b.vy += C.balloonGravityY * dt;
    if (b.vy > C.maxFallSpeed) b.vy = C.maxFallSpeed;

    // Mild horizontal drag.
    const drag = C.balloonDragX * dt;
    if (Math.abs(b.vx) <= drag) b.vx = 0;
    else b.vx -= Math.sign(b.vx) * drag;
    if (b.vx > C.balloonMaxVX) b.vx = C.balloonMaxVX;
    if (b.vx < -C.balloonMaxVX) b.vx = -C.balloonMaxVX;

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Side walls — bounce.
    if (b.x - BALLOON_HALF_W < 0) {
      b.x = BALLOON_HALF_W;
      b.vx = -b.vx * C.balloonWallBounce;
    } else if (b.x + BALLOON_HALF_W > WORLD_W) {
      b.x = WORLD_W - BALLOON_HALF_W;
      b.vx = -b.vx * C.balloonWallBounce;
    }
    // Ceiling.
    if (b.y - BALLOON_HALF_H < 0) {
      b.y = BALLOON_HALF_H;
      if (b.vy < 0) b.vy = -b.vy * C.balloonWallBounce;
    }
  }

  private resolveCollisions(now: number): void {
    const b = this.state.balloon;
    const isPractice = this.state.phase === 'waiting';

    // Balloon vs floor — round ends (or balloon respawns in practise mode).
    if (b.y + BALLOON_HALF_H >= GROUND_Y) {
      if (isPractice) this.respawnBalloonForPractice();
      else this.endRunTogether('balloon dropped');
      return;
    }

    // Balloon vs spikes — same shared loss regardless of which spike or who
    // last touched the balloon. We're all in this together.
    for (const s of this.state.spikes) {
      if (aabbOverlap(b.x, b.y, BALLOON_HALF_W, BALLOON_HALF_H, s.x, s.y, s.w, s.h)) {
        if (isPractice) this.respawnBalloonForPractice();
        else this.endRunTogether(s.o === 'up' ? 'balloon popped on a cactus' : 'balloon brushed the wall');
        return;
      }
    }

    // Balloon vs players — the bop.
    for (const seatId of this.state.seats) {
      if (!seatId) continue;
      const p = this.state.players.get(seatId);
      if (!p) continue;
      if (now - p.lastHitAt < C.hitCooldownMs) continue;
      if (!aabbOverlap(b.x, b.y, BALLOON_HALF_W, BALLOON_HALF_H, p.x, p.y, PLAYER_HALF_W, PLAYER_HALF_H)) continue;

      // Bounce away from player.
      const halfW = PLAYER_HALF_W;
      const offset = (b.x - p.x) / halfW;
      const clamped = Math.max(-1, Math.min(1, offset));
      let vx = clamped * C.balloonMaxBounceVX;
      let vy = C.balloonBounceVY;
      if (p.vy < -C.jumpBounceBoostThreshold) vy += C.jumpBounceBonusVY;
      b.vx = vx;
      b.vy = vy;
      // Snap balloon above the player to prevent immediate re-overlap.
      b.y = p.y - PLAYER_HALF_H - BALLOON_HALF_H - 2;

      p.hits += 1;
      p.lastHitAt = now;
      this.state.totalHits += 1;
      // Only one hit per tick — break.
      return;
    }
  }

  // -------- Spikes --------

  private addCactus(x: number, y: number, o: Orientation): void {
    // AABB sizes match BalloonScene.spawnCactus body sizes (cactusSize * 0.5 × 0.85).
    const long = C.cactusSize * 0.85;
    const short = C.cactusSize * 0.5;
    // Centre coords depend on orientation; mirror the origin/angle setup.
    if (o === 'up') {
      // origin (0.5, 1), angle 0 → body extends upward from y.
      this.state.spikes.push({
        x,
        y: y - long / 2,
        w: short / 2,
        h: long / 2,
        o,
        rx: x,
        ry: y,
      });
    } else if (o === 'down') {
      this.state.spikes.push({
        x,
        y: y + long / 2,
        w: short / 2,
        h: long / 2,
        o,
        rx: x,
        ry: y,
      });
    } else if (o === 'right') {
      // origin (0, 0.5), angle 90 → body extends to the right of x.
      this.state.spikes.push({
        x: x + long / 2,
        y,
        w: long / 2,
        h: short / 2,
        o,
        rx: x,
        ry: y,
      });
    } else {
      // left
      this.state.spikes.push({
        x: x - long / 2,
        y,
        w: long / 2,
        h: short / 2,
        o,
        rx: x,
        ry: y,
      });
    }
  }

  // Begin the wall-spike cycle in the "absent" state so the round starts
  // clean and the first spike pokes out after a short gap.
  private resetWallSpike(): void {
    this.state.wallSpikePresent = false;
    this.state.wallSpikeSide = Math.random() < 0.5 ? 'left' : 'right';
    this.state.wallSpikeChangeAt = Date.now() + C.wallSpikeAbsentMs;
  }

  // Tick driver: flip present↔absent when the timer elapses. Each appearance
  // alternates sides and picks a fresh random height.
  private updateWallSpike(now: number): void {
    if (now < this.state.wallSpikeChangeAt) return;
    if (this.state.wallSpikePresent) {
      // Last entry in spikes[] is the wall spike (always added after floor cacti).
      this.state.spikes.pop();
      this.state.wallSpikePresent = false;
      this.state.wallSpikeSide = this.state.wallSpikeSide === 'left' ? 'right' : 'left';
      this.state.wallSpikeChangeAt = now + C.wallSpikeAbsentMs;
    } else {
      const yFrac = C.wallSpikeMinFrac + Math.random() * (C.wallSpikeMaxFrac - C.wallSpikeMinFrac);
      const y = WORLD_H * yFrac;
      if (this.state.wallSpikeSide === 'left') {
        this.addCactus(C.wallPadding, y, 'right');
      } else {
        this.addCactus(WORLD_W - C.wallPadding, y, 'left');
      }
      this.state.wallSpikePresent = true;
      this.state.wallSpikeChangeAt = now + C.wallSpikePresentMs;
    }
  }

  // -------- Send / broadcast --------

  private broadcastSnapshot(): void {
    const snap = this.serializeState();
    const msg = JSON.stringify(snap);
    for (const sock of this.sockets.values()) {
      try {
        sock.socket.send(msg);
      } catch {
        // ignore; closer will fire and clean up
      }
    }
  }

  private broadcastEvent(ev: Record<string, unknown>): void {
    const msg = JSON.stringify(ev);
    for (const sock of this.sockets.values()) {
      try {
        sock.socket.send(msg);
      } catch {}
    }
  }

  private sendTo(id: string, payload: Record<string, unknown>): void {
    const sock = this.sockets.get(id);
    if (!sock) return;
    try {
      sock.socket.send(JSON.stringify(payload));
    } catch {}
  }

  private serializeState() {
    const players: Array<{
      id: string;
      n: string;
      c: string;
      x: number;
      y: number;
      vx: number;
      vy: number;
      h: number;
      f: boolean;
    }> = [];
    const seated = new Set([this.state.seats[0], this.state.seats[1]].filter(Boolean) as string[]);
    for (const id of seated) {
      const p = this.state.players.get(id);
      if (!p) continue;
      players.push({ id, n: p.nickname, c: p.clan, x: round1(p.x), y: round1(p.y), vx: round1(p.vx), vy: round1(p.vy), h: p.hits, f: p.facingLeft });
    }
    // Annotate queue + spectator nicknames for the lobby UI.
    const roster = [];
    for (const sock of this.sockets.values()) {
      if (!sock.helloed) continue;
      const role: 'seat0' | 'seat1' | 'queue' | 'spectator' =
        this.state.seats[0] === sock.id ? 'seat0'
        : this.state.seats[1] === sock.id ? 'seat1'
        : this.state.queue.includes(sock.id) ? 'queue'
        : 'spectator';
      roster.push({ id: sock.id, nickname: sock.nickname, clan: sock.clan, role });
    }
    return {
      t: 'state',
      tick: this.state.tick,
      phase: this.state.phase,
      practise: this.state.phase === 'waiting' && this.isPracticeActive(),
      balloon: {
        x: round1(this.state.balloon.x),
        y: round1(this.state.balloon.y),
        vx: round1(this.state.balloon.vx),
        vy: round1(this.state.balloon.vy),
      },
      seats: this.state.seats,
      queue: this.state.queue,
      players,
      roster,
      spikes: this.state.spikes.map((s) => ({ x: s.rx, y: s.ry, o: s.o })),
      totalHits: this.state.totalHits,
      teamScore: this.state.totalHits * 10 + (
        this.state.phase === 'playing' && this.state.roundStartedAt
          ? Math.floor((Date.now() - this.state.roundStartedAt) / 1000)
          : 0
      ),
      elapsedMs: this.state.phase === 'playing' && this.state.roundStartedAt
        ? Date.now() - this.state.roundStartedAt
        : 0,
      teamBest: this.state.teamBest,
      endReason: this.state.endReason,
      roundOverIn: this.state.phase === 'roundOver' ? Math.max(0, this.state.roundOverAt - Date.now()) : 0,
      worldW: WORLD_W,
      worldH: WORLD_H,
    };
  }
}

function aabbOverlap(
  ax: number, ay: number, ahw: number, ahh: number,
  bx: number, by: number, bhw: number, bhh: number,
): boolean {
  return Math.abs(ax - bx) < ahw + bhw && Math.abs(ay - by) < ahh + bhh;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
