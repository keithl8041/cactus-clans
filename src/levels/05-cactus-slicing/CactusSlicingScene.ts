import Phaser from 'phaser';
import { loadAsset } from '../../assets/loader';
import { sfx } from '../../assets/sfx';
import type { LevelContext } from '../types';
import { CACTUS_SLICING_CONFIG as CFG } from './config';

type ProjectileKind = 'cactus' | 'tarantula';

interface ProjectileData {
  kind: ProjectileKind;
  small: boolean;
  radius: number;
  trailEntry: boolean;
  entryX: number;
  entryY: number;
  lastOverlapX: number;
  lastOverlapY: number;
  spinPerSec: number;
}

interface TrailSample {
  x: number;
  y: number;
  t: number;
}

export class CactusSlicingScene extends Phaser.Scene {
  private readonly ctx: LevelContext;

  private score = 0;
  private strikes = 0;
  private passed = false;
  private finished = false;
  private startedAt = 0;

  // Projectiles + halves
  private projectiles: Phaser.Physics.Arcade.Sprite[] = [];

  // Trail
  private trail: TrailSample[] = [];
  private trailGfx!: Phaser.GameObjects.Graphics;
  private activePointerId: number | null = null;
  private swipeLengthPx = 0;
  private lastSampleX = 0;
  private lastSampleY = 0;

  // Combo
  private comboCount = 0;
  private lastSliceAt = 0;

  // Spawning
  private spawnTimer?: Phaser.Time.TimerEvent;
  private sessionTimer?: Phaser.Time.TimerEvent;

  // HUD
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private strikeIcons: Phaser.GameObjects.Image[] = [];
  private unlockBanner: Phaser.GameObjects.Text | null = null;

  constructor(ctx: LevelContext) {
    super({ key: 'CactusSlicingScene' });
    this.ctx = ctx;
  }

  preload(): void {
    loadAsset(this, 'cactus.whole', 'cactus.whole', { size: CFG.cactusDisplaySize });
    loadAsset(this, 'cactus.whole.small', 'cactus.whole', { size: CFG.cactusSmallDisplaySize, small: true });
    loadAsset(this, 'cactus.half.left', 'cactus.half.left', { size: CFG.cactusHalfSize });
    loadAsset(this, 'cactus.half.right', 'cactus.half.right', { size: CFG.cactusHalfSize });
    loadAsset(this, 'tarantula', 'tarantula', { size: CFG.tarantulaDisplaySize });
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, CFG.backgroundColor).setOrigin(0);

    this.physics.world.gravity.y = CFG.gravityY;
    // Disable world bounds — projectiles fly past the edges and despawn manually.
    this.physics.world.setBoundsCollision(false, false, false, false);

    this.trailGfx = this.add.graphics().setDepth(20);
    this.setupHud();
    this.setupInput();

    this.startedAt = this.time.now;
    this.scheduleNextSpawn();
    this.sessionTimer = this.time.delayedCall(CFG.sessionDurationMs, () => this.onTimeout());
  }

  update(time: number, delta: number): void {
    if (this.finished) return;

    const remainMs = Math.max(0, CFG.sessionDurationMs - (time - this.startedAt));
    this.timeText.setText(`Time: ${(remainMs / 1000).toFixed(1)}s`);

    // Prune expired trail samples and redraw.
    while (this.trail.length > 0 && time - this.trail[0].t > CFG.trailSampleLifetimeMs) {
      this.trail.shift();
    }
    this.redrawTrail(time);

    // If the trail emptied, clear per-projectile entry flags so a new swipe
    // doesn't inherit a stale "we entered this body" state.
    if (this.trail.length === 0) {
      for (const p of this.projectiles) {
        const data = p.getData('data') as ProjectileData;
        data.trailEntry = false;
      }
    }

    // Update projectiles: rotation, despawn check, slice detection.
    const { width, height } = this.scale;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const body = p.body as Phaser.Physics.Arcade.Body;
      const data = p.getData('data') as ProjectileData;

      // Continuous rotation while in flight
      p.rotation += (data.spinPerSec * Math.PI) / 180 * (delta / 1000);

      // Despawn if off-screen (below canvas, or far enough out left/right)
      if (p.y > height + 120 || p.x < -120 || p.x > width + 120) {
        this.projectiles.splice(i, 1);
        p.destroy();
        continue;
      }

      // Slice detection (only when we have a usable trail and the swipe is armed)
      if (this.trail.length >= 2 && this.swipeLengthPx >= CFG.trailMinSliceLengthPx) {
        const overlap = this.trailOverlapsCircle(p.x, p.y, data.radius);
        if (overlap.hit) {
          if (!data.trailEntry) {
            data.trailEntry = true;
            data.entryX = overlap.x;
            data.entryY = overlap.y;
          }
          data.lastOverlapX = overlap.x;
          data.lastOverlapY = overlap.y;
        } else if (data.trailEntry) {
          // Exited — check traversal length
          const traversal = Math.hypot(
            data.lastOverlapX - data.entryX,
            data.lastOverlapY - data.entryY,
          );
          data.trailEntry = false;
          if (traversal >= data.radius * 0.7) {
            const slashDx = data.lastOverlapX - data.entryX;
            const slashDy = data.lastOverlapY - data.entryY;
            this.projectiles.splice(i, 1);
            if (data.kind === 'cactus') {
              this.onSliceCactus(p, body.velocity.x, body.velocity.y, slashDx, slashDy);
            } else {
              this.onSliceTarantula(p);
            }
          }
        }
      }
    }
  }

  // ----- Setup -----

  private setupHud(): void {
    const { width } = this.scale;
    this.scoreText = this.add.text(CFG.hudPaddingPx, CFG.hudPaddingPx, `Score: 0 / ${CFG.passThreshold}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#f7c948',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(15);

    this.timeText = this.add.text(width - CFG.hudPaddingPx, CFG.hudPaddingPx, 'Time: 60.0s', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#f3efe0',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(15);

    // Strike icons (3 tarantulas across the top center)
    const iconY = CFG.hudPaddingPx + 14;
    for (let i = 0; i < CFG.strikeLimit; i++) {
      const x = width / 2 - ((CFG.strikeLimit - 1) / 2) * (CFG.strikeIconSize + 8) + i * (CFG.strikeIconSize + 8);
      const icon = this.add.image(x, iconY, 'tarantula').setDepth(15).setScrollFactor(0);
      icon.setScale(CFG.strikeIconSize / icon.height);
      icon.setAlpha(0.35);
      this.strikeIcons.push(icon);
    }
  }

  private setupInput(): void {
    this.input.addPointer(2);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);
  }

  // ----- Input -----

  private handlePointerDown(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    if (this.activePointerId != null) return; // single-finger slicing
    this.activePointerId = p.id;
    this.swipeLengthPx = 0;
    this.trail.push({ x: p.x, y: p.y, t: this.time.now });
    this.lastSampleX = p.x;
    this.lastSampleY = p.y;
  }

  private handlePointerMove(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    if (p.id !== this.activePointerId) return;
    if (!p.isDown) return;
    const dx = p.x - this.lastSampleX;
    const dy = p.y - this.lastSampleY;
    const d = Math.hypot(dx, dy);
    if (d < CFG.trailMinSampleSpacingPx) return;
    this.trail.push({ x: p.x, y: p.y, t: this.time.now });
    this.swipeLengthPx += d;
    this.lastSampleX = p.x;
    this.lastSampleY = p.y;
    while (this.trail.length > CFG.trailMaxSamples) this.trail.shift();
  }

  private handlePointerUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.activePointerId) return;
    this.activePointerId = null;
    // Do NOT clear the trail — let samples age out so a flick-and-release still
    // resolves slices for ~140ms after pointer-up.
  }

  // ----- Spawning -----

  private elapsedSec(): number {
    return Math.max(0, (this.time.now - this.startedAt) / 1000);
  }

  private currentSpawnIntervalMs(): number {
    return Math.max(
      CFG.spawnIntervalMinMs,
      CFG.spawnIntervalStartMs - this.elapsedSec() * CFG.spawnRampPerSecond,
    );
  }

  private currentBurstChance(): number {
    return Math.min(CFG.burstChanceMax, (this.elapsedSec() / CFG.burstRampSeconds) * CFG.burstChanceMax);
  }

  private currentTarantulaChance(): number {
    return Math.min(
      CFG.tarantulaChanceMax,
      CFG.tarantulaChanceStart + (this.elapsedSec() / CFG.tarantulaRampSeconds) * (CFG.tarantulaChanceMax - CFG.tarantulaChanceStart),
    );
  }

  private scheduleNextSpawn(): void {
    if (this.finished) return;
    this.spawnTimer = this.time.delayedCall(this.currentSpawnIntervalMs(), () => this.spawnTick());
  }

  private spawnTick(): void {
    if (this.finished) return;
    const count = Math.random() < this.currentBurstChance()
      ? Phaser.Math.Between(2, CFG.burstMaxSize)
      : 1;
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * CFG.burstStaggerMs, () => this.spawnOne());
    }
    this.scheduleNextSpawn();
  }

  private spawnOne(): void {
    if (this.finished) return;
    const { width, height } = this.scale;

    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -40 : width + 40;
    const y = Phaser.Math.FloatBetween(height * CFG.spawnYFractionMin, height * CFG.spawnYFractionMax);

    const isTarantula = Math.random() < this.currentTarantulaChance();
    const small = !isTarantula && this.elapsedSec() >= CFG.smallCactusUnlockSec && Math.random() < CFG.smallCactusChance;

    let texture: string;
    let radius: number;
    let displaySize: number;
    if (isTarantula) {
      texture = 'tarantula';
      radius = CFG.tarantulaRadiusPx;
      displaySize = CFG.tarantulaDisplaySize;
    } else if (small) {
      texture = 'cactus.whole.small';
      radius = CFG.cactusSmallRadiusPx;
      displaySize = CFG.cactusSmallDisplaySize;
    } else {
      texture = 'cactus.whole';
      radius = CFG.cactusRadiusPx;
      displaySize = CFG.cactusDisplaySize;
    }

    const sprite = this.physics.add.sprite(x, y, texture).setDepth(10);
    sprite.setScale(displaySize / sprite.height);
    const vx = Phaser.Math.FloatBetween(CFG.launchVxMin, CFG.launchVxMax) * (fromLeft ? 1 : -1);
    const vy = Phaser.Math.FloatBetween(CFG.launchVyMin, CFG.launchVyMax);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    sprite.setVelocity(vx, vy);

    const data: ProjectileData = {
      kind: isTarantula ? 'tarantula' : 'cactus',
      small,
      radius,
      trailEntry: false,
      entryX: 0,
      entryY: 0,
      lastOverlapX: 0,
      lastOverlapY: 0,
      spinPerSec: Phaser.Math.FloatBetween(CFG.spinPerSecMin, CFG.spinPerSecMax) * (Math.random() < 0.5 ? -1 : 1),
    };
    sprite.setData('data', data);
    this.projectiles.push(sprite);
  }

  // ----- Trail rendering + collision -----

  private redrawTrail(time: number): void {
    const g = this.trailGfx;
    g.clear();
    if (this.trail.length < 2) return;
    g.lineStyle(CFG.trailLineWidth, CFG.trailColor, 1);
    // Single strokePath for perf.
    g.beginPath();
    let started = false;
    for (let i = 0; i < this.trail.length; i++) {
      const s = this.trail[i];
      const age = time - s.t;
      const alpha = Math.max(0, 1 - age / CFG.trailSampleLifetimeMs);
      g.lineStyle(CFG.trailLineWidth, CFG.trailColor, alpha);
      if (!started) {
        g.moveTo(s.x, s.y);
        started = true;
      } else {
        g.lineTo(s.x, s.y);
      }
    }
    g.strokePath();
  }

  /**
   * Returns whether any active trail segment overlaps the circle, and if so,
   * the closest-point on the deepest-overlapping segment to the circle center.
   */
  private trailOverlapsCircle(cx: number, cy: number, r: number): { hit: boolean; x: number; y: number } {
    let bestDist = Infinity;
    let bestX = 0;
    let bestY = 0;
    for (let i = 0; i < this.trail.length - 1; i++) {
      const a = this.trail[i];
      const b = this.trail[i + 1];
      const { dist, x, y } = closestPointOnSegment(a.x, a.y, b.x, b.y, cx, cy);
      if (dist < bestDist) {
        bestDist = dist;
        bestX = x;
        bestY = y;
      }
    }
    if (bestDist <= r) return { hit: true, x: bestX, y: bestY };
    return { hit: false, x: 0, y: 0 };
  }

  // ----- Slice handlers -----

  private onSliceCactus(
    sprite: Phaser.Physics.Arcade.Sprite,
    vx: number,
    vy: number,
    slashDx: number,
    slashDy: number,
  ): void {
    const x = sprite.x;
    const y = sprite.y;
    const data = sprite.getData('data') as ProjectileData;
    sprite.destroy();

    // Spawn two halves with perpendicular kick.
    const len = Math.hypot(slashDx, slashDy) || 1;
    const perpX = -slashDy / len;
    const perpY = slashDx / len;
    const size = data.small ? CFG.cactusSmallDisplaySize : CFG.cactusHalfSize;

    const halfLeft = this.physics.add.sprite(x, y, 'cactus.half.left').setDepth(11);
    halfLeft.setScale(size / halfLeft.height);
    (halfLeft.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
    halfLeft.setVelocity(vx + perpX * CFG.halfKickPx, vy + perpY * CFG.halfKickPx);
    halfLeft.setAngularVelocity(CFG.halfSpinPerSec);
    this.tweens.add({
      targets: halfLeft,
      alpha: 0,
      duration: CFG.halfFadeOutMs,
      onComplete: () => halfLeft.destroy(),
    });

    const halfRight = this.physics.add.sprite(x, y, 'cactus.half.right').setDepth(11);
    halfRight.setScale(size / halfRight.height);
    (halfRight.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
    halfRight.setVelocity(vx - perpX * CFG.halfKickPx, vy - perpY * CFG.halfKickPx);
    halfRight.setAngularVelocity(-CFG.halfSpinPerSec);
    this.tweens.add({
      targets: halfRight,
      alpha: 0,
      duration: CFG.halfFadeOutMs,
      onComplete: () => halfRight.destroy(),
    });

    // Combo logic
    if (this.time.now - this.lastSliceAt < CFG.sliceComboWindowMs) {
      this.comboCount += 1;
    } else {
      this.comboCount = 1;
    }
    this.lastSliceAt = this.time.now;
    const tier = Math.min(this.comboCount, CFG.comboMaxTier);
    const points = CFG.slicePointsBase + (tier - 1) * CFG.comboTierBonusStep;
    this.score += points;
    this.updateScoreText();

    const label = this.comboCount >= 2 ? `COMBO ×${this.comboCount} +${points}` : `+${points}`;
    this.spawnFloatingText(x, y, label);

    if (this.comboCount >= 3) sfx.bullseye();
    else sfx.thunk();

    if (!this.passed && this.score >= CFG.passThreshold) this.markUnlocked();
  }

  private onSliceTarantula(sprite: Phaser.Physics.Arcade.Sprite): void {
    const x = sprite.x;
    const y = sprite.y;
    sprite.destroy();

    this.strikes += 1;
    this.comboCount = 0; // break combo
    if (this.strikes <= this.strikeIcons.length) {
      const icon = this.strikeIcons[this.strikes - 1];
      icon.setAlpha(1);
      icon.setTint(0xd24a3a);
    }

    this.cameras.main.shake(120, 0.008);
    sfx.pop();

    // Small "explosion" tween — quick scale up + fade
    const burst = this.add.image(x, y, 'tarantula').setDepth(12);
    burst.setScale(CFG.tarantulaDisplaySize / burst.height);
    burst.setTint(0xd24a3a);
    this.tweens.add({
      targets: burst,
      scale: burst.scale * 1.6,
      alpha: 0,
      duration: 280,
      onComplete: () => burst.destroy(),
    });

    if (this.strikes > CFG.strikeLimit) this.finish(false);
  }

  // ----- HUD -----

  private updateScoreText(): void {
    if (this.passed) {
      this.scoreText.setText(`Score: ${this.score} ✓`);
    } else {
      this.scoreText.setText(`Score: ${this.score} / ${CFG.passThreshold}`);
    }
  }

  private spawnFloatingText(x: number, y: number, text: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#fff5b7',
      fontStyle: 'bold',
      stroke: '#7a4d0c',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(18);
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 700,
      ease: 'Sine.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /**
   * Threshold reached — next level unlocked, but the player keeps slicing for
   * bonus points until the timer ends. Mirrors L1/L2/L3/L4.
   */
  private markUnlocked(): void {
    this.passed = true;
    sfx.unlock();
    this.scoreText.setColor('#9efc9b');
    this.updateScoreText();

    const { width, height } = this.scale;
    this.unlockBanner = this.add.text(width / 2, height / 2, 'Level Unlocked!\nKeep slicing for bonus', {
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

  private onTimeout(): void {
    this.finish(this.score >= CFG.passThreshold);
  }

  private finish(passed: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.passed = passed;
    this.spawnTimer?.remove();
    this.sessionTimer?.remove();

    if (this.unlockBanner) {
      this.unlockBanner.destroy();
      this.unlockBanner = null;
    }

    const elapsedMs = Math.min(CFG.sessionDurationMs, this.time.now - this.startedAt);

    const { width, height } = this.scale;
    const failedByStrikes = this.strikes > CFG.strikeLimit;
    let text: string;
    let color: string;
    let stroke: string;
    if (passed) {
      text = `Cleared!\nFinal: ${this.score} pts`;
      color = '#9efc9b';
      stroke = '#1f5a2d';
    } else if (failedByStrikes) {
      text = `Too many tarantulas!\nScore: ${this.score}`;
      color = '#d24a3a';
      stroke = '#5a2d1f';
    } else {
      text = `Time!\nScore: ${this.score}`;
      color = '#f7c948';
      stroke = '#5a2d1f';
    }
    if (!passed) sfx.pop();

    const banner = this.add.text(width / 2, height / 2, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '34px',
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

    this.time.delayedCall(1300, () => {
      this.ctx.onComplete({
        passed: this.passed,
        miniGamePoints: this.score,
        elapsedMs,
      });
    });
  }
}

function closestPointOnSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): { dist: number; x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { dist: Math.hypot(px - ax, py - ay), x: ax, y: ay };
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return { dist: Math.hypot(px - x, py - y), x, y };
}
