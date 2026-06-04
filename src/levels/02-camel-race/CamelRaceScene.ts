import Phaser from 'phaser';
import { loadAsset } from '../../assets/loader';
import { resolveCamelKey } from '../../assets/manifest';
import { sfx } from '../../assets/sfx';
import type { LevelContext } from '../types';
import { CAMEL_RACE_CONFIG as CFG } from './config';

type ObstacleKind = 'rock' | 'cactus';

interface ActivePointer {
  downAt: number;
  downX: number;
  downY: number;
  moved: boolean;
  side: 'left' | 'right';
  laneShifted: boolean;
}

interface ObstacleEntity {
  sprite: Phaser.GameObjects.Image;
  worldX: number;
  lane: number;
  kind: ObstacleKind;
  hit: boolean;
}

interface PickupEntity {
  sprite: Phaser.GameObjects.Image;
  worldX: number;
  lane: number;
  collected: boolean;
}

export class CamelRaceScene extends Phaser.Scene {
  private readonly ctx: LevelContext;

  private distanceCovered = 0;
  private lane = 1;
  private targetLane = 1;
  private laneTween: Phaser.Tweens.Tween | null = null;

  private stamina: number = CFG.staminaStart;
  private staminaDisabled = false;
  private dashBurstUntil = 0;
  private hitPenaltyUntil = 0;
  private iframesUntil = 0;

  private flaskCount = 0;
  private bonusPoints = 0;
  private passed = false;
  private finished = false;
  private startedAt = 0;
  private livesRemaining: number = CFG.livesStart;
  private livesOut = false;

  private camel!: Phaser.GameObjects.Image;
  private camelBaseScale = 1;
  // Lane Y the lane-change tween animates; the actual camel.y is this plus the
  // running-gait bob (sine wave applied each frame in update()).
  private camelLaneY = 0;
  private camelBobPhase = 0;
  private parallaxFar!: Phaser.GameObjects.TileSprite;
  private parallaxMid!: Phaser.GameObjects.TileSprite;
  private parallaxNear!: Phaser.GameObjects.TileSprite;
  private floor!: Phaser.GameObjects.TileSprite;
  private finishBanner: Phaser.GameObjects.Image | null = null;

  private obstacles: ObstacleEntity[] = [];
  private pickups: PickupEntity[] = [];
  private nextObstacleSpawnX = 0;
  private nextPickupSpawnX = 0;

  private activePointers = new Map<number, ActivePointer>();

  // Keyboard
  private keySpace!: Phaser.Input.Keyboard.Key;

  // HUD
  private staminaBar!: Phaser.GameObjects.Graphics;
  private distText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private flaskText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private staminaFlashAlpha = 0;

  constructor(ctx: LevelContext) {
    super({ key: 'CamelRaceScene' });
    this.ctx = ctx;
  }

  preload(): void {
    loadAsset(this, 'camel', resolveCamelKey(this.ctx.clan.name), {
      clanColor: this.ctx.clan.color,
      size: CFG.camelSize,
    });
    loadAsset(this, 'rock', 'rock', { size: CFG.obstacleSize });
    loadAsset(this, 'cactus.spike.game2', 'cactus.spike.game2');
    loadAsset(this, 'waterFlask', 'waterFlask', { size: CFG.pickupSize });
    loadAsset(this, 'desert.parallax.far', 'desert.parallax.far');
    loadAsset(this, 'desert.parallax.mid', 'desert.parallax.mid');
    loadAsset(this, 'desert.parallax.near', 'desert.parallax.near');
    loadAsset(this, 'game2.floor', 'game2.floor');
    loadAsset(this, 'finishBanner', 'finishBanner', { size: CFG.finishBannerSize });
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, CFG.backgroundColor).setOrigin(0);

    this.setupParallax();
    this.setupCamel();
    this.setupHud();
    this.setupInput();

    this.startedAt = this.time.now;
    this.nextObstacleSpawnX = 1500; // warmup buffer (no obstacles for first ~4s)
    this.nextPickupSpawnX = 900;
  }

  update(_time: number, delta: number): void {
    if (this.finished) return;
    const dt = delta / 1000;
    const { width } = this.scale;
    const elapsed = this.time.now - this.startedAt;

    // Resolve sustained dash from active pointers + keyboard
    const sustainedDashing = this.computeSustainedDashing();
    const dashBurstActive = this.time.now < this.dashBurstUntil;
    const wantDash = sustainedDashing || dashBurstActive;
    const canDash = !this.staminaDisabled && this.stamina > 0;
    const dashing = wantDash && canDash;

    // Compute speed
    const progress = this.distanceCovered / CFG.courseDistancePx;
    const baseSpeed = Phaser.Math.Linear(CFG.baseSpeed, CFG.baseSpeedFinal, Math.min(1, progress));
    const lowMult = this.staminaDisabled ? CFG.baseSpeedLow / CFG.baseSpeed : 1;
    const hitActive = this.time.now < this.hitPenaltyUntil;
    const hitMult = hitActive ? CFG.hitSpeedMult : 1;
    const dashMult = dashing ? CFG.dashMult : 1;
    const speed = baseSpeed * lowMult * hitMult * dashMult;

    // Advance distance
    const advance = speed * dt;
    this.distanceCovered = Math.min(CFG.courseDistancePx, this.distanceCovered + advance);

    // Stamina tick
    this.stamina += CFG.staminaRegenPerSec * dt;
    if (dashing) this.stamina -= CFG.staminaDashDrainPerSec * dt;
    this.stamina = Phaser.Math.Clamp(this.stamina, 0, CFG.staminaMax);
    if (this.stamina <= 0) this.staminaDisabled = true;
    if (this.staminaDisabled && this.stamina >= CFG.staminaRecoveryThreshold) {
      this.staminaDisabled = false;
    }

    // Running-gait bob — sine wave on y only. Phase advances faster as the
    // world scrolls faster, so the gait visibly ramps with dash and slows when
    // stamina-stalled. No rotation: the bottom-anchored origin made tilt
    // visually shrink the camel.
    const speedRatio = speed / CFG.baseSpeed;
    const gaitScale = Phaser.Math.Clamp(speedRatio, 0.4, 1.6);
    this.camelBobPhase += dt * Math.PI * 2 * CFG.camelBobHz * gaitScale;
    const bobY = Math.sin(this.camelBobPhase) * CFG.camelBobAmplitudePx * Math.min(1, speedRatio);
    this.camel.y = this.camelLaneY + bobY;

    // Parallax scroll
    this.parallaxFar.tilePositionX += advance * CFG.parallaxFarMult;
    this.parallaxMid.tilePositionX += advance * CFG.parallaxMidMult;
    this.parallaxNear.tilePositionX += advance * CFG.parallaxNearMult;
    // Floor is the camel's ground plane — scroll at 1:1 with the world so it feels
    // locked to the obstacles/pickups (which also move at full world speed).
    this.floor.tilePositionX += advance;

    // Translate entities
    const camelX = width * CFG.camelXFraction;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.sprite.x = o.worldX - this.distanceCovered + camelX;
      if (o.sprite.x < -120) {
        o.sprite.destroy();
        this.obstacles.splice(i, 1);
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.sprite.x = p.worldX - this.distanceCovered + camelX;
      if (p.sprite.x < -120 || p.collected) {
        p.sprite.destroy();
        this.pickups.splice(i, 1);
      }
    }

    // Spawn obstacles + pickups one screen ahead
    const obstacleSpawnLimit = CFG.courseDistancePx - CFG.obstacleFinishClearDistancePx;
    while (this.nextObstacleSpawnX < this.distanceCovered + width + 200 && this.nextObstacleSpawnX <= obstacleSpawnLimit) {
      this.spawnObstacleRow(this.nextObstacleSpawnX);
      this.nextObstacleSpawnX += this.currentObstacleGap();
    }
    while (this.nextPickupSpawnX < this.distanceCovered + width + 200) {
      this.spawnPickup(this.nextPickupSpawnX);
      const jitter = 1 + Phaser.Math.FloatBetween(-CFG.pickupSpawnJitter, CFG.pickupSpawnJitter);
      this.nextPickupSpawnX += CFG.pickupSpawnEveryPx * jitter;
    }

    // Collision check (only entities within ±60 of camel)
    const checkXMin = camelX - 60;
    const checkXMax = camelX + 60;
    const inIframes = this.time.now < this.iframesUntil;
    for (const o of this.obstacles) {
      if (o.hit) continue;
      if (o.lane !== this.lane) continue;
      if (o.sprite.x < checkXMin || o.sprite.x > checkXMax) continue;
      if (inIframes) continue;
      this.onObstacleHit(o);
    }
    for (const p of this.pickups) {
      if (p.collected) continue;
      if (p.lane !== this.lane) continue;
      if (p.sprite.x < checkXMin || p.sprite.x > checkXMax) continue;
      this.onPickup(p);
    }

    // Finish banner reveal
    if (!this.finishBanner && this.distanceCovered + width >= CFG.parallaxFinishBannerAtPx) {
      this.spawnFinishBanner();
    }
    if (this.finishBanner) {
      this.finishBanner.x = CFG.courseDistancePx - this.distanceCovered + camelX;
      if (this.finishBanner.x < -200) {
        this.finishBanner.destroy();
        this.finishBanner = null;
      }
    }

    // HUD
    this.redrawStaminaBar(dashing, dt);
    this.distText.setText(`Distance: ${(this.distanceCovered / 100).toFixed(0)} / ${(CFG.courseDistancePx / 100).toFixed(0)}`);
    this.timeText.setText(`Time: ${((CFG.courseTimeLimitMs - elapsed) / 1000).toFixed(1)}s`);

    // End checks
    if (this.distanceCovered >= CFG.courseDistancePx) {
      this.finishRace(false /*timedOut*/, true /*finishedLine*/);
      return;
    }
    if (elapsed >= CFG.courseTimeLimitMs) {
      this.finishRace(true, false);
      return;
    }
  }

  // ----- Setup -----

  private setupParallax(): void {
    const { width, height } = this.scale;
    // Parallax PNGs are 1280×720 — designed to stack at full canvas size.
    // Far is an opaque sky+horizon; mid/near are transparent above their silhouettes
    // so each upper layer reveals what's behind. TileSprite repeats horizontally as we scroll.
    this.parallaxFar = this.add.tileSprite(width / 2, height / 2, width, height, 'desert.parallax.far')
      .setDepth(1);
    this.parallaxMid = this.add.tileSprite(width / 2, height / 2, width, height, 'desert.parallax.mid')
      .setDepth(2);
    this.parallaxNear = this.add.tileSprite(width / 2, height / 2, width, height, 'desert.parallax.near')
      .setDepth(3);
    // Floor strip: native 150px tall, pinned to the canvas bottom. Strip top sits at
    // canvas y=570; lanes are arranged at +15/+60/+105 from there (see config).
    const floorH = 150;
    this.floor = this.add.tileSprite(width / 2, height - floorH / 2, width, floorH, 'game2.floor')
      .setDepth(4);
  }

  private setupCamel(): void {
    const { width, height } = this.scale;
    const x = width * CFG.camelXFraction;
    this.camelLaneY = CFG.laneYFractions[this.lane] * height;
    this.camel = this.add.image(x, this.camelLaneY, 'camel').setOrigin(0.5, 1).setDepth(this.camelDepthFor(this.lane));
    this.camelBaseScale = CFG.camelSize / this.camel.height;
    this.camel.setScale(this.camelBaseScale * CFG.laneScales[this.lane]);
  }

  private setupHud(): void {
    const { width } = this.scale;
    this.distText = this.add.text(16, 16, 'Distance: 0 / 198', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#f7c948',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(15);

    this.flaskText = this.add.text(16, 44, 'Flasks: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#a3c8e6',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(15);

    this.timeText = this.add.text(width - 16, 16, 'Time: 90.0s', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#f3efe0',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(15);

    this.livesText = this.add.text(width - 16, 44, `Lives: ${this.livesRemaining}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#ff8c8c',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(15);

    this.staminaBar = this.add.graphics().setDepth(15).setScrollFactor(0);
  }

  private setupInput(): void {
    this.input.addPointer(2);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);

    const kb = this.input.keyboard!;
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    kb.on('keydown-LEFT', () => this.requestLaneChange(-1));
    kb.on('keydown-A', () => this.requestLaneChange(-1));
    kb.on('keydown-UP', () => this.requestLaneChange(-1));
    kb.on('keydown-W', () => this.requestLaneChange(-1));
    kb.on('keydown-RIGHT', () => this.requestLaneChange(1));
    kb.on('keydown-D', () => this.requestLaneChange(1));
    kb.on('keydown-DOWN', () => this.requestLaneChange(1));
    kb.on('keydown-S', () => this.requestLaneChange(1));
    kb.on('keydown-SPACE', () => this.fireDashBurst());
  }

  // ----- Input handlers -----

  private handlePointerDown(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    // Ignore presses in the HUD inset region.
    if (p.y < CFG.holdZoneInsetPx) return;
    const side: 'left' | 'right' = p.x < this.scale.width / 2 ? 'left' : 'right';
    this.activePointers.set(p.id, {
      downAt: this.time.now,
      downX: p.x,
      downY: p.y,
      moved: false,
      side,
      laneShifted: false,
    });
    // Immediate edge-triggered lane shift on press.
    this.requestLaneChange(side === 'left' ? -1 : 1);
    this.activePointers.get(p.id)!.laneShifted = true;
  }

  private handlePointerMove(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    const entry = this.activePointers.get(p.id);
    if (!entry || !p.isDown) return;
    if (!entry.moved) {
      const dx = Math.abs(p.x - entry.downX);
      const dy = Math.abs(p.y - entry.downY);
      if (dx > CFG.tapMoveThresholdPx || dy > CFG.tapMoveThresholdPx) entry.moved = true;
    }
  }

  private handlePointerUp(p: Phaser.Input.Pointer): void {
    const entry = this.activePointers.get(p.id);
    this.activePointers.delete(p.id);
    if (!entry) return;
    const held = this.time.now - entry.downAt;
    if (!entry.moved && held < CFG.tapMaxMs) {
      // Quick tap → dash burst (lane shift already fired on press).
      this.fireDashBurst();
    }
  }

  private computeSustainedDashing(): boolean {
    // Any pointer held past tapMaxMs counts as sustained dash.
    for (const entry of this.activePointers.values()) {
      if (this.time.now - entry.downAt >= CFG.tapMaxMs) return true;
    }
    // Keyboard: hold space for sustained.
    if (this.keySpace.isDown) return true;
    return false;
  }

  private fireDashBurst(): void {
    if (this.finished || this.staminaDisabled || this.stamina <= 0) return;
    this.stamina = Math.max(0, this.stamina - CFG.staminaTapFloor);
    this.dashBurstUntil = Math.max(this.dashBurstUntil, this.time.now + CFG.dashBurstMs);
  }

  // ----- Lane logic -----

  private requestLaneChange(dir: number): void {
    if (this.finished) return;
    if (this.laneTween) return; // wait for current tween
    const target = Phaser.Math.Clamp(this.lane + dir, 0, CFG.laneCount - 1);
    if (target === this.lane) return;
    this.targetLane = target;
    // Snap depth to the target lane at tween start so the camel correctly
    // weaves in front of / behind obstacles in adjacent lanes during the move.
    this.camel.setDepth(this.camelDepthFor(target));
    const { height } = this.scale;
    // Tween the lane-Y on the scene (not camel.y directly) so the per-frame
    // sine-wave bob in update() can ride on top without fighting the tween.
    this.laneTween = this.tweens.add({
      targets: this,
      camelLaneY: CFG.laneYFractions[target] * height,
      duration: CFG.laneChangeMs,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.lane = this.targetLane;
        this.laneTween = null;
      },
    });
    this.tweens.add({
      targets: this.camel,
      scale: this.camelBaseScale * CFG.laneScales[target],
      duration: CFG.laneChangeMs,
      ease: 'Sine.easeOut',
    });
  }

  // Camel sits 0.5 above obstacles/pickups in the SAME lane (focal point), but
  // below entities in any further-forward lane (so they occlude the player).
  private camelDepthFor(lane: number): number {
    return 10 + lane + 0.5;
  }

  // ----- Spawning -----

  private currentObstacleGap(): number {
    const progress = this.distanceCovered / CFG.courseDistancePx;
    return Phaser.Math.Linear(CFG.obstacleBaseGapPx, CFG.obstacleEndGapPx, Math.min(1, progress));
  }

  private spawnObstacleRow(worldX: number): void {
    const progress = this.distanceCovered / CFG.courseDistancePx;
    const lanesToBlock = Math.round(
      Phaser.Math.Linear(CFG.obstacleLanesAtOnceStart, CFG.obstacleLanesAtOnceEnd, Math.min(1, progress)),
    );
    const lanes = [0, 1, 2];
    Phaser.Utils.Array.Shuffle(lanes);
    for (let i = 0; i < lanesToBlock && i < lanes.length; i++) {
      const lane = lanes[i];
      const kind: ObstacleKind = Math.random() < CFG.obstacleRockChance ? 'rock' : 'cactus';
      const texture = kind === 'rock' ? 'rock' : 'cactus.spike.game2';
      const { height } = this.scale;
      const y = CFG.laneYFractions[lane] * height;
      const sprite = this.add.image(0, y, texture).setOrigin(0.5, 1).setDepth(10 + lane);
      sprite.setScale((CFG.obstacleSize / sprite.height) * CFG.laneScales[lane]);
      this.obstacles.push({ sprite, worldX, lane, kind, hit: false });
    }
  }

  private spawnPickup(worldX: number): void {
    // Pick a lane NOT in the nearest upcoming obstacle row (within ±300 worldX).
    const blockedLanes = new Set<number>();
    for (const o of this.obstacles) {
      if (Math.abs(o.worldX - worldX) < 300) blockedLanes.add(o.lane);
    }
    const candidates = [0, 1, 2].filter((l) => !blockedLanes.has(l));
    const lane = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : Math.floor(Math.random() * 3);

    const { height } = this.scale;
    const y = CFG.laneYFractions[lane] * height;
    const sprite = this.add.image(0, y, 'waterFlask').setOrigin(0.5, 1).setDepth(10 + lane);
    sprite.setScale((CFG.pickupSize / sprite.height) * CFG.laneScales[lane]);
    this.pickups.push({ sprite, worldX, lane, collected: false });
  }

  private spawnFinishBanner(): void {
    const { height } = this.scale;
    // Drop into the lane area so the camel runs *through* the banner like a real
    // finish ribbon. Banner stays at a lower depth (6) than the camel (10+), so
    // the camel always reads as breaking through it.
    this.finishBanner = this.add.image(0, height * 0.75, 'finishBanner').setDepth(6);
    this.finishBanner.setScale(CFG.finishBannerSize / this.finishBanner.height);
  }

  // ----- Collisions -----

  private onObstacleHit(o: ObstacleEntity): void {
    o.hit = true;
    this.stamina = Math.max(0, this.stamina - CFG.staminaHitPenalty);
    if (this.stamina <= 0) this.staminaDisabled = true;
    this.hitPenaltyUntil = this.time.now + CFG.hitSpeedPenaltyMs;
    this.iframesUntil = this.time.now + CFG.hitIframesMs;
    this.cameras.main.shake(140, 0.008);
    sfx.pop();

    this.livesRemaining = Math.max(0, this.livesRemaining - 1);
    this.livesText.setText(`Lives: ${this.livesRemaining}`);
    this.livesText.setColor('#ff3a3a');
    this.tweens.add({
      targets: this.livesText,
      scale: { from: 1.5, to: 1 },
      duration: 240,
      ease: 'Back.easeOut',
      onComplete: () => this.livesText?.setColor('#ff8c8c'),
    });

    // Blink camel for iframe duration
    this.tweens.add({
      targets: this.camel,
      alpha: 0.3,
      duration: 120,
      yoyo: true,
      repeat: Math.floor(CFG.hitIframesMs / 240),
      onComplete: () => this.camel.setAlpha(1),
    });

    // Fade obstacle so it doesn't re-collide
    this.tweens.add({
      targets: o.sprite,
      alpha: 0,
      duration: 200,
    });

    if (this.livesRemaining <= 0) {
      this.livesOut = true;
      this.finishRace(false, false);
    }
  }

  private onPickup(p: PickupEntity): void {
    p.collected = true;
    this.flaskCount += 1;
    this.bonusPoints += CFG.pickupBonusPoints;
    this.stamina = Math.min(CFG.staminaMax, this.stamina + CFG.staminaPickupGain);
    if (this.staminaDisabled && this.stamina >= CFG.staminaRecoveryThreshold) {
      this.staminaDisabled = false;
    }
    this.flaskText.setText(`Flasks: ${this.flaskCount}`);
    sfx.star();
    // Sparkle pop
    this.tweens.add({
      targets: p.sprite,
      scale: p.sprite.scale * 1.4,
      alpha: 0,
      duration: 220,
    });
  }

  // ----- HUD redraw -----

  private redrawStaminaBar(dashing: boolean, dt: number): void {
    const { width } = this.scale;
    const barW = 180;
    const barH = 14;
    const x = width / 2 - barW / 2;
    const y = 40;
    const g = this.staminaBar;
    g.clear();
    // Pulse the bar when staminaDisabled
    if (this.staminaDisabled) {
      this.staminaFlashAlpha = (this.staminaFlashAlpha + dt * 4) % (Math.PI * 2);
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(this.staminaFlashAlpha));
      g.fillStyle(0xd24a3a, 0.4 * pulse);
      g.fillRoundedRect(x - 3, y - 3, barW + 6, barH + 6, 6);
    } else {
      this.staminaFlashAlpha = 0;
    }
    g.fillStyle(0x1a1a1a, 0.6);
    g.fillRoundedRect(x, y, barW, barH, 4);
    const fillW = (this.stamina / CFG.staminaMax) * (barW - 4);
    const color = dashing ? 0xf7c948 : this.staminaDisabled ? 0xd24a3a : 0x9efc9b;
    g.fillStyle(color, 1);
    g.fillRoundedRect(x + 2, y + 2, fillW, barH - 4, 2);
  }

  // ----- End state -----

  private finishRace(timedOut: boolean, finishedLine: boolean): void {
    if (this.finished) return;
    this.finished = true;

    // Passed if we crossed the finish OR timer expired with ≥ 85% of the course.
    const reachedLine = finishedLine || this.distanceCovered >= CFG.courseDistancePx;
    const reachedFraction = this.distanceCovered >= CFG.courseDistancePx * CFG.passDistanceFraction;
    this.passed = reachedLine || reachedFraction;

    const elapsedMs = Math.min(CFG.courseTimeLimitMs, this.time.now - this.startedAt);
    const miniGamePoints = Math.floor(this.distanceCovered / 100);

    const { width, height } = this.scale;
    let text: string;
    let color: string;
    let stroke: string;
    if (reachedLine) {
      text = `Finish!\n${miniGamePoints} pts · ${this.flaskCount} flasks`;
      color = '#9efc9b';
      stroke = '#1f5a2d';
    } else if (this.passed) {
      text = `Made it!\n${miniGamePoints} pts · ${this.flaskCount} flasks`;
      color = '#f7c948';
      stroke = '#5a2d1f';
    } else if (this.livesOut) {
      text = `Out of lives!\n${miniGamePoints} pts`;
      color = '#d24a3a';
      stroke = '#5a2d1f';
    } else {
      text = `Out of time.\n${miniGamePoints} pts`;
      color = '#d24a3a';
      stroke = '#5a2d1f';
    }
    if (!this.passed) sfx.pop();
    else if (reachedLine) sfx.unlock();

    const banner = this.add.text(width / 2, height / 2, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '32px',
      color,
      fontStyle: 'bold',
      stroke,
      strokeThickness: 5,
      align: 'center',
    }).setOrigin(0.5).setDepth(25).setAlpha(0);
    this.tweens.add({
      targets: banner,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.6, to: 1 },
      duration: 280,
      ease: 'Back.easeOut',
    });

    void timedOut;
    this.time.delayedCall(1400, () => {
      this.ctx.onComplete({
        passed: this.passed,
        miniGamePoints,
        elapsedMs,
        bonusPoints: this.bonusPoints,
      });
    });
  }
}
