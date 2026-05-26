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

  private camel!: Phaser.GameObjects.Image;
  private parallaxFar!: Phaser.GameObjects.TileSprite;
  private parallaxMid!: Phaser.GameObjects.TileSprite;
  private parallaxNear!: Phaser.GameObjects.TileSprite;
  private finishBanner: Phaser.GameObjects.Image | null = null;

  private obstacles: ObstacleEntity[] = [];
  private pickups: PickupEntity[] = [];
  private nextObstacleSpawnX = 0;
  private nextPickupSpawnX = 0;

  private activePointers = new Map<number, ActivePointer>();

  // Keyboard
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  // HUD
  private staminaBar!: Phaser.GameObjects.Graphics;
  private distText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private flaskText!: Phaser.GameObjects.Text;
  private staminaFlashAlpha = 0;
  private unlockBanner: Phaser.GameObjects.Text | null = null;

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
    loadAsset(this, 'cactus.spike', 'cactus.spike');
    loadAsset(this, 'waterFlask', 'waterFlask', { size: CFG.pickupSize });
    loadAsset(this, 'desert.parallax.far', 'desert.parallax.far');
    loadAsset(this, 'desert.parallax.mid', 'desert.parallax.mid');
    loadAsset(this, 'desert.parallax.near', 'desert.parallax.near');
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

    // Parallax scroll
    this.parallaxFar.tilePositionX += advance * CFG.parallaxFarMult;
    this.parallaxMid.tilePositionX += advance * CFG.parallaxMidMult;
    this.parallaxNear.tilePositionX += advance * CFG.parallaxNearMult;

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
    while (this.nextObstacleSpawnX < this.distanceCovered + width + 200) {
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
      if (o.sprite.x < checkXMin || o.sprite.x > checkXMax) continue;
      if (Math.abs(o.sprite.y - this.camel.y) > CFG.obstacleSize * CFG.obstacleColliderScale) continue;
      if (inIframes) continue;
      this.onObstacleHit(o);
    }
    for (const p of this.pickups) {
      if (p.collected) continue;
      if (p.sprite.x < checkXMin || p.sprite.x > checkXMax) continue;
      if (Math.abs(p.sprite.y - this.camel.y) > CFG.pickupSize * CFG.pickupColliderScale) continue;
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

    // Latch unlock at 85% (so the "Level Unlocked" banner fires before the finish line).
    if (!this.passed && this.distanceCovered >= CFG.courseDistancePx * CFG.passDistanceFraction) {
      this.markUnlocked();
    }
  }

  // ----- Setup -----

  private setupParallax(): void {
    const { width, height } = this.scale;
    // The parallax SVGs are 1024x240. We stretch them vertically/horizontally
    // to cover the sky area; TileSprite repeats horizontally as we scroll.
    const skyH = height * 0.65;
    this.parallaxFar = this.add.tileSprite(width / 2, skyH * 0.40, width, skyH * 0.5, 'desert.parallax.far')
      .setDepth(1);
    this.parallaxMid = this.add.tileSprite(width / 2, skyH * 0.65, width, skyH * 0.6, 'desert.parallax.mid')
      .setDepth(2);
    // Ground strip (solid color) sits below the parallax layers.
    this.add.rectangle(0, skyH, width, height - skyH, CFG.groundColor).setOrigin(0).setDepth(3);
    this.parallaxNear = this.add.tileSprite(width / 2, skyH + (height - skyH) * 0.20, width, (height - skyH) * 0.6, 'desert.parallax.near')
      .setDepth(4);
  }

  private setupCamel(): void {
    const { width, height } = this.scale;
    const x = width * CFG.camelXFraction;
    const y = CFG.laneYFractions[this.lane] * height;
    this.camel = this.add.image(x, y, 'camel').setDepth(8);
    this.camel.setScale(CFG.camelSize / this.camel.height);
  }

  private setupHud(): void {
    const { width } = this.scale;
    this.distText = this.add.text(16, 16, 'Distance: 0 / 180', {
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

    this.staminaBar = this.add.graphics().setDepth(15).setScrollFactor(0);
  }

  private setupInput(): void {
    this.input.addPointer(2);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    kb.on('keydown-LEFT', () => this.requestLaneChange(-1));
    kb.on('keydown-A', () => this.requestLaneChange(-1));
    kb.on('keydown-RIGHT', () => this.requestLaneChange(1));
    kb.on('keydown-D', () => this.requestLaneChange(1));
    kb.on('keydown-UP', () => this.fireDashBurst());
    kb.on('keydown-W', () => this.fireDashBurst());
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
    // Keyboard: hold space, W, or up for sustained.
    if (this.keySpace.isDown || this.keyW.isDown || this.cursors.up?.isDown) return true;
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
    const { height } = this.scale;
    this.laneTween = this.tweens.add({
      targets: this.camel,
      y: CFG.laneYFractions[target] * height,
      duration: CFG.laneChangeMs,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.lane = this.targetLane;
        this.laneTween = null;
      },
    });
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
      const texture = kind === 'rock' ? 'rock' : 'cactus.spike';
      const { height } = this.scale;
      const y = CFG.laneYFractions[lane] * height;
      const sprite = this.add.image(0, y, texture).setDepth(7);
      sprite.setScale(CFG.obstacleSize / sprite.height);
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
    const sprite = this.add.image(0, y, 'waterFlask').setDepth(7);
    sprite.setScale(CFG.pickupSize / sprite.height);
    this.pickups.push({ sprite, worldX, lane, collected: false });
  }

  private spawnFinishBanner(): void {
    const { height } = this.scale;
    this.finishBanner = this.add.image(0, height * 0.42, 'finishBanner').setDepth(6);
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

  /**
   * 85% of course reached — next level unlocked. Player keeps racing for the
   * finish line + bonus pickups. Mirrors L1/L2/L3/L4/L5.
   */
  private markUnlocked(): void {
    this.passed = true;
    sfx.unlock();
    this.distText.setColor('#9efc9b');

    const { width, height } = this.scale;
    this.unlockBanner = this.add.text(width / 2, height / 2, 'Level Unlocked!\nKeep going for the finish line', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '30px',
      color: '#fff5b7',
      fontStyle: 'bold',
      stroke: '#1f5a2d',
      strokeThickness: 5,
      align: 'center',
    }).setOrigin(0.5).setDepth(25).setAlpha(0);

    this.tweens.add({
      targets: this.unlockBanner,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.6, to: 1 },
      duration: 280,
      ease: 'Back.easeOut',
    });
    this.time.delayedCall(1500, () => {
      const b = this.unlockBanner;
      if (!b || !b.active) return;
      this.tweens.add({
        targets: b,
        alpha: 0,
        y: b.y - 30,
        duration: 500,
        ease: 'Sine.easeIn',
        onComplete: () => {
          b.destroy();
          this.unlockBanner = null;
        },
      });
    });
  }

  // ----- End state -----

  private finishRace(timedOut: boolean, finishedLine: boolean): void {
    if (this.finished) return;
    this.finished = true;

    // Passed if we crossed the finish OR timer expired with ≥ 85% of the course.
    const reachedLine = finishedLine || this.distanceCovered >= CFG.courseDistancePx;
    const reachedFraction = this.distanceCovered >= CFG.courseDistancePx * CFG.passDistanceFraction;
    this.passed = reachedLine || reachedFraction;

    if (this.unlockBanner) {
      this.unlockBanner.destroy();
      this.unlockBanner = null;
    }

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
