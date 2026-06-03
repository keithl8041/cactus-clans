import Phaser from 'phaser';
import { loadAsset } from '../assets/loader';
import { sfx } from '../assets/sfx';
import { clanByName } from '../data/clans';
import { resolveBalloonKey, resolveCharacterKey } from '../assets/manifest';
import { trackEvent } from '../services/analytics';
import type { VersusClient, VersusState, VersusPlayer, VersusSpike } from '../services/versus';

// Versus mode is locked to Prickling Clan art for now — the other clans
// don't have shipped balloon/character PNGs yet. The server uses whatever
// the client sends in `hello`, so this also matches what VersusLobby tells
// the DO. Seat 1 gets a warm tint applied client-side to keep two
// Pricklings visually distinct in play.
const FORCED_CLAN = 'Prickling Clan';
const FORCED_FORM = 1;
const SEAT1_TINT = 0xff9a5c;

const WORLD_W = 1280;
const WORLD_H = 720;

// Mirror the visual sizes used by the single-player level.
const BALLOON_DISPLAY = 96;
const PLAYER_DISPLAY = 96;
const CACTUS_DISPLAY = 80;

interface VersusSceneCtx {
  client: VersusClient;
}

interface ActivePointer {
  side: 'left' | 'right';
  // y where this pointer first touched down. Once the drag exceeds
  // SWIPE_UP_JUMP_PX upward, we queue a jump and latch `jumped` so the
  // same stroke doesn't re-fire as the finger keeps moving.
  startY: number;
  jumped: boolean;
}

const SWIPE_UP_JUMP_PX = 60;

interface PlayerVisuals {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  // Latest server state for tween smoothing.
  targetX: number;
  targetY: number;
  // Hit count we last saw — used to detect when to flash on a bop.
  lastSeenHits: number;
  facingLeft: boolean;
  baseScaleX: number;
  baseScaleY: number;
  /** Seat index we last applied the tint for (-1 = queue/spectator/unknown). */
  lastSeatIdx: number;
}

export class VersusBalloonScene extends Phaser.Scene {
  private readonly client: VersusClient;

  private balloon!: Phaser.GameObjects.Image;
  private balloonTargetX = WORLD_W / 2;
  private balloonTargetY = WORLD_H * 0.3;

  private players = new Map<string, PlayerVisuals>();
  private spikeSprites: Phaser.GameObjects.Image[] = [];
  private lastSpikeCount = 0;

  // Last phase we saw from the server, so we can fire an analytics event on the
  // edge into 'playing' (a round actually starting) rather than every tick.
  private lastPhase: VersusState['phase'] | null = null;

  private hitText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private teamBestText!: Phaser.GameObjects.Text;
  private roundEndBanner: Phaser.GameObjects.Text | null = null;

  // Input.
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private activePointers = new Map<number, ActivePointer>();
  private jumpButtonBg!: Phaser.GameObjects.Arc;
  private jumpButtonLabel!: Phaser.GameObjects.Text;
  private jumpButtonHit!: Phaser.Geom.Circle;
  private jumpQueued = false; // edge-triggered — cleared after we forward it

  constructor(ctx: VersusSceneCtx) {
    super({ key: 'VersusBalloonScene' });
    this.client = ctx.client;
  }

  preload(): void {
    // Real Prickling art for everyone; background + floor reuse single-player.
    const clan = clanByName(FORCED_CLAN);
    loadAsset(this, 'balloon', resolveBalloonKey(FORCED_CLAN), {
      color: clan?.color,
      size: BALLOON_DISPLAY,
    });
    loadAsset(this, 'cactus.spike', 'cactus.spike');
    loadAsset(this, 'character', resolveCharacterKey(FORCED_CLAN, FORCED_FORM), {
      clanColor: clan?.color,
      formNumber: FORCED_FORM,
      size: PLAYER_DISPLAY,
    });
    loadAsset(this, 'game1.background', 'game1.background');
    loadAsset(this, 'game1.floor', 'game1.floor');
  }

  create(): void {
    this.add.image(0, 0, 'game1.background').setOrigin(0).setDisplaySize(WORLD_W, WORLD_H);
    this.add.image(0, WORLD_H - 60, 'game1.floor').setOrigin(0).setDisplaySize(WORLD_W, 60);

    this.balloon = this.add.image(this.balloonTargetX, this.balloonTargetY, 'balloon');
    this.balloon.setDisplaySize(BALLOON_DISPLAY, BALLOON_DISPLAY);
    this.balloon.setDepth(5);

    this.setupHud();
    this.setupInput();
    this.setupJumpButton();

    // Subscribe to state updates from the DO. The scene unsubscribes on shutdown.
    const offState = this.client.on('state', (s) => this.applyState(s));
    const offRoundEnd = this.client.on('roundEnd', (e) => this.onRoundEnd(e));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offState();
      offRoundEnd();
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      offState();
      offRoundEnd();
    });
  }

  update(_time: number, dt: number): void {
    this.sendInput();
    this.interpolate(dt);
  }

  // ---- Input ----

  private setupInput(): void {
    this.input.addPointer(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.handlePointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.handlePointerMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.handlePointerUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.handlePointerUp(p));

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    kb.on('keydown-SPACE', () => this.queueJump());
    kb.on('keydown-UP', () => this.queueJump());
    kb.on('keydown-W', () => this.queueJump());
  }

  private setupJumpButton(): void {
    const r = 56;
    const cx = WORLD_W - 18 - r;
    const cy = WORLD_H - 60 - 18 - r;
    this.jumpButtonBg = this.add.circle(cx, cy, r, 0xf7c948, 0.85)
      .setStrokeStyle(3, 0x7a4d0c)
      .setScrollFactor(0)
      .setDepth(12);
    this.jumpButtonLabel = this.add.text(cx, cy, '↑', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.round(r * 0.86)}px`,
      color: '#3d2a07',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(13);
    this.jumpButtonHit = new Phaser.Geom.Circle(cx, cy, r + 12);
  }

  private handlePointerDown(p: Phaser.Input.Pointer): void {
    if (Phaser.Geom.Circle.Contains(this.jumpButtonHit, p.x, p.y)) {
      this.tweens.killTweensOf(this.jumpButtonBg);
      this.tweens.killTweensOf(this.jumpButtonLabel);
      this.jumpButtonBg.setScale(0.88);
      this.jumpButtonLabel.setScale(0.88);
      this.tweens.add({ targets: [this.jumpButtonBg, this.jumpButtonLabel], scale: 1, duration: 140, ease: 'Back.easeOut' });
      this.queueJump();
      return;
    }
    this.activePointers.set(p.id, {
      side: p.x < WORLD_W / 2 ? 'left' : 'right',
      startY: p.y,
      jumped: false,
    });
  }

  private handlePointerMove(p: Phaser.Input.Pointer): void {
    if (!p.isDown) return;
    const entry = this.activePointers.get(p.id);
    if (!entry) return;
    entry.side = p.x < WORLD_W / 2 ? 'left' : 'right';
    // One stroke, one role. Once a pointer fires a swipe-up jump, drop it
    // from the steering map so the jump gesture doesn't continue to drag
    // the character sideways. Lift + re-tap to steer again.
    if (!entry.jumped && entry.startY - p.y >= SWIPE_UP_JUMP_PX) {
      entry.jumped = true;
      this.activePointers.delete(p.id);
      this.queueJump();
    }
  }

  private handlePointerUp(p: Phaser.Input.Pointer): void {
    this.activePointers.delete(p.id);
  }

  private queueJump(): void {
    this.jumpQueued = true;
  }

  private sendInput(): void {
    let pointerLeft = false;
    let pointerRight = false;
    for (const e of this.activePointers.values()) {
      if (e.side === 'left') pointerLeft = true;
      else pointerRight = true;
    }
    const left = pointerLeft || this.cursors.left?.isDown || this.keyA.isDown;
    const right = pointerRight || this.cursors.right?.isDown || this.keyD.isDown;
    const j = this.jumpQueued;
    this.jumpQueued = false;
    this.client.sendInput({ l: !!left && !right, r: !!right && !left, j });
  }

  // ---- State application ----

  private applyState(s: VersusState): void {
    this.balloonTargetX = s.balloon.x;
    this.balloonTargetY = s.balloon.y;

    // Players: add/update/remove.
    const seenIds = new Set<string>();
    for (const sp of s.players) {
      seenIds.add(sp.id);
      let vis = this.players.get(sp.id);
      if (!vis) vis = this.createPlayerVisuals(sp);
      vis.targetX = sp.x;
      vis.targetY = sp.y;
      vis.facingLeft = sp.f;
      vis.sprite.setFlipX(!sp.f); // sprite faces left by default; flip when facing right
      // Distinguish identical Pricklings by seat: seat 0 natural, seat 1 warm tint.
      const seatIdx = s.seats.indexOf(sp.id);
      if (seatIdx !== vis.lastSeatIdx) {
        vis.lastSeatIdx = seatIdx;
        if (seatIdx === 1) vis.sprite.setTint(SEAT1_TINT);
        else vis.sprite.clearTint();
      }
      // Bop feedback — flash the player who just gained a hit.
      if (sp.h > vis.lastSeenHits) {
        this.flashPlayer(vis);
        if (sp.id === this.client.id) sfx.hit();
      }
      vis.lastSeenHits = sp.h;
    }
    for (const [id, vis] of this.players) {
      if (!seenIds.has(id)) {
        vis.sprite.destroy();
        vis.label.destroy();
        this.players.delete(id);
      }
    }

    // Spikes — when a new round starts, the server resets the array. Compare
    // count instead of diffing element-by-element; spike list is append-only
    // within a round, so a shrink means "new round → clear and re-add".
    if (s.spikes.length < this.lastSpikeCount) {
      this.clearSpikes();
    }
    while (this.spikeSprites.length < s.spikes.length) {
      const idx = this.spikeSprites.length;
      this.spikeSprites.push(this.makeSpikeSprite(s.spikes[idx]));
    }
    this.lastSpikeCount = s.spikes.length;

    // Total-hit "ding" for the local player — already handled per-player above.

    // Shared cooperative HUD: one combined score and time, plus the team-best
    // tracker. No per-seat tallies — we're keeping the balloon up together.
    const seconds = (s.elapsedMs / 1000).toFixed(1);
    this.hitText.setText(`Together: ${s.totalHits} ${s.totalHits === 1 ? 'bop' : 'bops'} · ${seconds}s`);
    if (s.teamBest.score > 0) {
      const names = s.teamBest.nicknames.length > 0 ? ` — ${s.teamBest.nicknames.join(' & ')}` : '';
      this.teamBestText.setText(`Best together: ${s.teamBest.score}${names}`);
      this.teamBestText.setVisible(true);
    } else {
      this.teamBestText.setVisible(false);
    }
    if (s.phase === 'waiting') {
      this.phaseText.setText(s.practise ? 'Practise — keep it up!' : 'Waiting for a friend…');
    } else {
      this.phaseText.setText('');
    }

    // Edge-trigger a round_start when the server flips into 'playing'.
    if (s.phase !== this.lastPhase) {
      if (s.phase === 'playing') {
        trackEvent('versus_round_start', {
          practise: s.practise,
          players: s.players.length,
        });
      }
      this.lastPhase = s.phase;
    }
  }

  private createPlayerVisuals(sp: VersusPlayer): PlayerVisuals {
    const sprite = this.add.sprite(sp.x, sp.y, 'character');
    sprite.setDisplaySize(PLAYER_DISPLAY, PLAYER_DISPLAY);
    sprite.setDepth(4);
    const label = this.add.text(sp.x, sp.y - PLAYER_DISPLAY / 2 - 6, sp.n, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#fff5b7',
      fontStyle: 'bold',
      stroke: '#1f2a14',
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(11);
    const vis: PlayerVisuals = {
      sprite,
      label,
      targetX: sp.x,
      targetY: sp.y,
      lastSeenHits: sp.h,
      facingLeft: sp.f,
      baseScaleX: sprite.scaleX,
      baseScaleY: sprite.scaleY,
      lastSeatIdx: -1,
    };
    this.players.set(sp.id, vis);
    return vis;
  }

  private flashPlayer(vis: PlayerVisuals): void {
    const sprite = vis.sprite;
    this.tweens.killTweensOf(sprite);
    sprite.setScale(vis.baseScaleX * 1.15, vis.baseScaleY * 1.15);
    this.tweens.add({
      targets: sprite,
      scaleX: vis.baseScaleX,
      scaleY: vis.baseScaleY,
      duration: 160,
      ease: 'Back.easeOut',
    });
  }

  private makeSpikeSprite(s: VersusSpike): Phaser.GameObjects.Image {
    const img = this.add.image(s.x, s.y, 'cactus.spike');
    img.setDisplaySize(CACTUS_DISPLAY, CACTUS_DISPLAY);
    img.setDepth(3);
    // Origin + angle match what BalloonScene does for AABB-equivalent rendering.
    switch (s.o) {
      case 'up':
        img.setOrigin(0.5, 1);
        img.setAngle(0);
        break;
      case 'down':
        img.setOrigin(0.5, 0);
        img.setAngle(180);
        break;
      case 'left':
        img.setOrigin(1, 0.5);
        img.setAngle(-90);
        break;
      case 'right':
        img.setOrigin(0, 0.5);
        img.setAngle(90);
        break;
    }
    return img;
  }

  private clearSpikes(): void {
    for (const s of this.spikeSprites) s.destroy();
    this.spikeSprites = [];
    this.lastSpikeCount = 0;
  }

  private setupHud(): void {
    this.hitText = this.add.text(WORLD_W / 2, 18, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#f7c948',
      fontStyle: 'bold',
      stroke: '#1f2a14',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(10);

    this.teamBestText = this.add.text(WORLD_W / 2, 46, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#fff5b7',
      stroke: '#1f2a14',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(10).setVisible(false);

    this.phaseText = this.add.text(WORLD_W / 2, WORLD_H * 0.4, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '32px',
      color: '#fff5b7',
      fontStyle: 'bold',
      stroke: '#1f5a2d',
      strokeThickness: 5,
      align: 'center',
    }).setOrigin(0.5).setDepth(15);
  }

  // ---- Round end overlay ----

  private onRoundEnd(e: {
    reason: string;
    teamScore: number;
    teamHits: number;
    elapsedMs: number;
    newTeamBest: boolean;
    teamBest: { score: number; nicknames: string[] };
  }): void {
    trackEvent('versus_round_end', {
      reason: e.reason,
      team_score: e.teamScore,
      team_hits: e.teamHits,
      elapsed_ms: e.elapsedMs,
      new_team_best: e.newTeamBest,
    });
    sfx.pop();
    const seconds = (e.elapsedMs / 1000).toFixed(1);
    const bopWord = e.teamHits === 1 ? 'bop' : 'bops';
    const lines = [`♥ Together: ${e.teamHits} ${bopWord} · ${seconds}s`, e.reason + '.'];
    if (e.newTeamBest) lines.push('New team best!');
    const text = lines.join('\n');
    if (this.roundEndBanner) this.roundEndBanner.destroy();
    this.roundEndBanner = this.add.text(WORLD_W / 2, WORLD_H / 2, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '36px',
      color: e.newTeamBest ? '#fff5b7' : '#f7c948',
      fontStyle: 'bold',
      stroke: '#1f5a2d',
      strokeThickness: 6,
      align: 'center',
    }).setOrigin(0.5).setDepth(25).setAlpha(0);
    this.tweens.add({
      targets: this.roundEndBanner,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.6, to: 1 },
      duration: 240,
      ease: 'Back.easeOut',
    });
    this.time.delayedCall(2400, () => {
      const banner = this.roundEndBanner;
      if (!banner) return;
      this.tweens.add({
        targets: banner,
        alpha: 0,
        duration: 400,
        onComplete: () => banner.destroy(),
      });
      this.roundEndBanner = null;
    });
  }

  // ---- Frame interpolation ----

  private interpolate(dt: number): void {
    // Snap-with-lerp toward target. dt is in ms; convert to a 0..1 weight.
    const ms = Math.max(0, Math.min(50, dt));
    const w = 1 - Math.pow(0.001, ms / 1000); // ~exponential approach
    this.balloon.x += (this.balloonTargetX - this.balloon.x) * w;
    this.balloon.y += (this.balloonTargetY - this.balloon.y) * w;
    for (const vis of this.players.values()) {
      vis.sprite.x += (vis.targetX - vis.sprite.x) * w;
      vis.sprite.y += (vis.targetY - vis.sprite.y) * w;
      vis.label.x = vis.sprite.x;
      vis.label.y = vis.sprite.y - PLAYER_DISPLAY / 2 - 6;
    }
  }
}
