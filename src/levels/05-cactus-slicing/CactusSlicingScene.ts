import Phaser from 'phaser';
import { loadAsset } from '../../assets/loader';
import { sfx } from '../../assets/sfx';
import { isMusicEnabled } from '../../assets/musicPrefs';
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
  minDistToCenter: number;
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
  private misses = 0;
  private passed = false;
  private passedAtMs = 0;
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
  private swipeTimeoutTimer?: Phaser.Time.TimerEvent;

  // HUD
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private strikeIcons: Phaser.GameObjects.Image[] = [];
  private missPips: Phaser.GameObjects.Image[] = [];
  private unlockBanner: Phaser.GameObjects.Text | null = null;
  private music: Phaser.Sound.BaseSound | null = null;

  constructor(ctx: LevelContext) {
    super({ key: 'CactusSlicingScene' });
    this.ctx = ctx;
  }

  preload(): void {
    loadAsset(this, 'game5.background', 'game5.background');
    loadAsset(this, 'cactus.whole', 'cactus.whole');
    loadAsset(this, 'cactus.whole.small', 'cactus.whole');
    loadAsset(this, 'cactus.half.left', 'cactus.half.left');
    loadAsset(this, 'cactus.half.right', 'cactus.half.right');
    loadAsset(this, 'tarantula', 'tarantula');
    this.load.audio('music.level5', '/music/whichclanareyou.mp3');
  }

  private ensureSparkTexture(): void {
    if (this.textures.exists('slice-spark')) return;
    const r = CFG.sparkRadiusClean;
    const g = this.add.graphics();
    g.fillStyle(0xfff5b7, 1);
    g.fillCircle(r, r, r);
    g.generateTexture('slice-spark', r * 2, r * 2);
    g.destroy();
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, CFG.backgroundColor).setOrigin(0).setDepth(-1);
    this.add.image(width / 2, height / 2, 'game5.background').setDisplaySize(width, height).setDepth(0);

    this.physics.world.gravity.y = CFG.gravityY;
    // Disable world bounds — projectiles fly past the edges and despawn manually.
    this.physics.world.setBoundsCollision(false, false, false, false);

    this.ensureSparkTexture();
    this.trailGfx = this.add.graphics().setDepth(20);
    this.setupHud();
    this.setupInput();

    this.music = this.sound.add('music.level5', { loop: true, volume: 0.45 });
    if (isMusicEnabled()) this.music.play();

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
        data.minDistToCenter = Infinity;
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
        const droppedBelow = p.y > height + 120;
        p.destroy();
        if (droppedBelow && data.kind === 'cactus') this.onCactusDropped();
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
            data.minDistToCenter = overlap.minDist;
          } else if (overlap.minDist < data.minDistToCenter) {
            data.minDistToCenter = overlap.minDist;
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
            const clean = data.minDistToCenter <= data.radius * CFG.cleanCutFraction;
            this.projectiles.splice(i, 1);
            if (data.kind === 'cactus') {
              this.onSliceCactus(p, body.velocity.x, body.velocity.y, slashDx, slashDy, clean);
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

    // Strike icons (tarantulas across the top center)
    const iconY = CFG.hudPaddingPx + 14;
    for (let i = 0; i < CFG.strikeLimit; i++) {
      const x = width / 2 - ((CFG.strikeLimit - 1) / 2) * (CFG.strikeIconSize + 8) + i * (CFG.strikeIconSize + 8);
      const icon = this.add.image(x, iconY, 'tarantula').setDepth(15).setScrollFactor(0);
      icon.setScale(CFG.strikeIconSize / icon.height);
      icon.setAlpha(0.35);
      this.strikeIcons.push(icon);
    }

    // Miss pips (dropped-cactus budget) — small grey cacti, top-center below strikes
    const pipY = iconY + CFG.strikeIconSize / 2 + CFG.missPipSize / 2 + 6;
    const pipSpacing = CFG.missPipSize + 4;
    for (let i = 0; i < CFG.missTolerance; i++) {
      const x = width / 2 - ((CFG.missTolerance - 1) / 2) * pipSpacing + i * pipSpacing;
      const pip = this.add.image(x, pipY, 'cactus.whole.small').setDepth(15).setScrollFactor(0);
      pip.setScale(CFG.missPipSize / pip.height);
      pip.setAlpha(0.25);
      pip.setTint(0x6e6e6e);
      this.missPips.push(pip);
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
    this.swipeTimeoutTimer = this.time.delayedCall(CFG.maxSwipeDurationMs, () => this.forceEndSwipe());
  }

  private forceEndSwipe(): void {
    if (this.activePointerId == null) return;
    this.activePointerId = null;
    this.comboCount = 0;
    // Brief red flash to signal the swipe was cut off
    const { width, height } = this.scale;
    const flash = this.add.rectangle(0, 0, width, height, 0xd24a3a).setOrigin(0).setAlpha(0.25).setDepth(30);
    this.tweens.add({ targets: flash, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
    this.spawnFloatingText(width / 2, height * 0.4, 'LIFT TO SLICE!', false);
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
    this.swipeTimeoutTimer?.remove();
    this.swipeTimeoutTimer = undefined;
    // Combos require one continuous stroke — lifting always ends the combo.
    this.comboCount = 0;
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
      minDistToCenter: Infinity,
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
  private trailOverlapsCircle(cx: number, cy: number, r: number): { hit: boolean; x: number; y: number; minDist: number } {
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
    if (bestDist <= r) return { hit: true, x: bestX, y: bestY, minDist: bestDist };
    return { hit: false, x: 0, y: 0, minDist: bestDist };
  }

  // ----- Slice handlers -----

  private onSliceCactus(
    sprite: Phaser.Physics.Arcade.Sprite,
    vx: number,
    vy: number,
    slashDx: number,
    slashDy: number,
    clean: boolean,
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

    // Combo logic — only count when pointer is still down (continuous stroke)
    const inStroke = this.activePointerId != null;
    if (inStroke && this.time.now - this.lastSliceAt < CFG.sliceComboWindowMs) {
      this.comboCount += 1;
    } else {
      this.comboCount = 1;
    }
    this.lastSliceAt = this.time.now;
    const tier = Math.min(this.comboCount, CFG.comboMaxTier);
    const basePoints = CFG.slicePointsBase + (tier - 1) * CFG.comboTierBonusStep;
    const cleanBonus = clean ? CFG.cleanCutBonus : 0;
    const points = basePoints + cleanBonus;
    this.score += points;
    this.updateScoreText();

    // Slash spark at the slice midpoint
    this.spawnSlashSpark(x, y, clean);

    let label: string;
    if (this.comboCount >= 2 && clean) label = `COMBO ×${this.comboCount} +${points} CLEAN`;
    else if (this.comboCount >= 2) label = `COMBO ×${this.comboCount} +${points}`;
    else if (clean) label = `+${points} CLEAN`;
    else label = `+${points}`;
    this.spawnFloatingText(x, y, label, clean);

    if (this.comboCount >= CFG.comboSlowMoTier) {
      this.triggerSlowMo();
      sfx.bullseye();
    } else {
      sfx.thunk();
    }

    if (!this.passed && this.score >= CFG.passThreshold) this.markUnlocked();
  }

  private spawnSlashSpark(x: number, y: number, clean: boolean): void {
    const radius = clean ? CFG.sparkRadiusClean : CFG.sparkRadius;
    const tint = clean ? 0xfff5b7 : 0xfde68a;
    const spark = this.add.image(x, y, 'slice-spark').setDepth(19).setTint(tint);
    const scale = (radius * 2) / spark.width;
    spark.setScale(scale * 0.4);
    spark.setAlpha(0.9);
    this.tweens.add({
      targets: spark,
      scale: scale,
      alpha: 0,
      duration: CFG.sparkDurationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => spark.destroy(),
    });
  }

  private triggerSlowMo(): void {
    this.time.timeScale = CFG.slowMoTimeScale;
    this.physics.world.timeScale = 1 / CFG.slowMoTimeScale; // arcade physics inverts: >1 slows
    // Real-wall-clock delay: the timer event is scheduled on the same scaled clock,
    // so it lasts ~ duration / timeScale in real ms — that's the intended beat.
    this.time.delayedCall(CFG.slowMoDurationMs, () => {
      this.time.timeScale = 1;
      this.physics.world.timeScale = 1;
    });
  }

  private flashStrike(): void {
    const { width, height } = this.scale;
    const flash = this.add
      .rectangle(0, 0, width, height, CFG.strikeFlashColor)
      .setOrigin(0)
      .setAlpha(0.35)
      .setDepth(30)
      .setScrollFactor(0);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: CFG.strikeFlashDurationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  private onCactusDropped(): void {
    if (this.finished) return;
    // Bonus mode (already cleared) — drops are cosmetic, never fail the round.
    if (this.passed) return;
    this.misses += 1;
    const idx = this.misses - 1;
    if (idx < this.missPips.length) {
      const pip = this.missPips[idx];
      pip.setAlpha(0.9);
      pip.setTint(0xd24a3a);
    }
    if (this.misses >= CFG.missTolerance) this.finish(false);
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

    this.cameras.main.shake(CFG.strikeShakeMs, CFG.strikeShakeIntensity);
    this.flashStrike();
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

    if (this.strikes >= CFG.strikeLimit) this.finish(this.passed);
  }

  // ----- HUD -----

  private updateScoreText(): void {
    if (this.passed) {
      this.scoreText.setText(`Score: ${this.score} ✓`);
    } else {
      this.scoreText.setText(`Score: ${this.score} / ${CFG.passThreshold}`);
    }
  }

  private spawnFloatingText(x: number, y: number, text: string, clean = false): void {
    const t = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: clean ? '26px' : '22px',
      color: clean ? '#ffffff' : '#fff5b7',
      fontStyle: 'bold',
      stroke: clean ? '#c98a18' : '#7a4d0c',
      strokeThickness: clean ? 4 : 3,
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
    this.passedAtMs = this.time.now - this.startedAt;
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
    this.music?.stop();
    this.passed = passed;
    this.spawnTimer?.remove();
    this.sessionTimer?.remove();
    this.time.timeScale = 1;
    this.physics.world.timeScale = 1;

    if (this.unlockBanner) {
      this.unlockBanner.destroy();
      this.unlockBanner = null;
    }

    const elapsedMs = this.passed ? this.passedAtMs : Math.min(CFG.sessionDurationMs, this.time.now - this.startedAt);

    const { width, height } = this.scale;
    const failedByStrikes = this.strikes >= CFG.strikeLimit;
    const failedByDrops = this.misses >= CFG.missTolerance;
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
    } else if (failedByDrops) {
      text = `Too many got away!\nScore: ${this.score}`;
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
