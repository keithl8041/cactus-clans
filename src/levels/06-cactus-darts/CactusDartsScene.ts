import Phaser from 'phaser';
import { loadAsset } from '../../assets/loader';
import { resolveCharacterKey } from '../../assets/manifest';
import { sfx } from '../../assets/sfx';
import type { LevelContext } from '../types';
import { CACTUS_DARTS_CONFIG as CFG } from './config';

export class CactusDartsScene extends Phaser.Scene {
  private readonly ctx: LevelContext;

  private player!: Phaser.Physics.Arcade.Sprite;
  private board!: Phaser.Physics.Arcade.Sprite;
  private spike: Phaser.Physics.Arcade.Sprite | null = null;
  private spikeInsideBoard = false;
  private spikeMinDist = Infinity;
  private readonly spikeMinPoint = new Phaser.Math.Vector2();
  private trajectory!: Phaser.GameObjects.Graphics;
  private slingLine!: Phaser.GameObjects.Graphics;

  private score = 0;
  private hitCount = 0;
  private quiverRemaining = CFG.quiverSize;
  private startedAt = 0;
  private finished = false;
  private passed = false;

  private scoreText!: Phaser.GameObjects.Text;
  private quiverText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;

  private dragging = false;
  private readonly dragStart = new Phaser.Math.Vector2();
  private readonly dragCurrent = new Phaser.Math.Vector2();
  private dragPointerId: number | null = null;

  private boardBaseY = 0;

  // Keyboard fallback (desktop). Aim angle in degrees from horizontal (negative = up).
  private keyboardAim = { angleDeg: -38, power: 0.7 };
  private keyboardCharging = false;

  constructor(ctx: LevelContext) {
    super({ key: 'CactusDartsScene' });
    this.ctx = ctx;
  }

  preload(): void {
    loadAsset(this, 'character', resolveCharacterKey(this.ctx.clan.name, this.ctx.formNumber), {
      clanColor: this.ctx.clan.color,
      formNumber: this.ctx.formNumber,
      size: CFG.playerSize,
    });
    loadAsset(this, 'cactus.spike', 'cactus.spike');
    loadAsset(this, 'dartboard', 'dartboard', { size: CFG.boardSize });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x2a1a0c).setOrigin(0);
    this.add.rectangle(0, height - CFG.floorPadding, width, CFG.floorPadding, 0x7a5a3a).setOrigin(0);

    this.physics.world.gravity.y = CFG.gravityY;

    this.setupPlayer();
    this.setupBoard();
    this.setupOverlays();
    this.setupInput();
    this.setupHud();

    this.startedAt = this.time.now;
  }

  update(time: number, _delta: number): void {
    if (this.finished) return;

    const { width, height } = this.scale;
    const elapsedMs = time - this.startedAt;
    this.timeText.setText(`Time: ${(elapsedMs / 1000).toFixed(1)}s`);

    if (this.hitCount >= CFG.boardDriftStartHit) {
      const extra = this.hitCount - CFG.boardDriftStartHit;
      const period = CFG.boardDriftPeriodMs * Math.pow(CFG.boardDriftPeriodMultPerHit, extra);
      const phase = (time / period) * Math.PI * 2;
      this.board.y = this.boardBaseY + Math.sin(phase) * CFG.boardDriftAmplitudePx;
    }

    this.trajectory.clear();
    this.slingLine.clear();
    if (this.dragging) {
      const { vx, vy } = this.dragToVelocity();
      this.drawSwipeArrow(this.dragStart.x, this.dragStart.y, this.dragCurrent.x, this.dragCurrent.y);
      this.drawTrajectoryPreview(this.player.x, this.player.y, vx, vy);
    } else if (this.keyboardCharging) {
      const { vx, vy } = this.keyboardAimToVelocity();
      this.drawTrajectoryPreview(this.player.x, this.player.y, vx, vy);
    }

    if (this.spike) {
      const s = this.spike;
      const body = s.body as Phaser.Physics.Arcade.Body;
      if (body.velocity.x !== 0 || body.velocity.y !== 0) {
        // The spike SVG points up; offset by +π/2 so it flies tip-first.
        s.setRotation(Math.atan2(body.velocity.y, body.velocity.x) + Math.PI / 2);
      }

      // Manual penetration tracking: score at the spike's closest approach to
      // the board center, not at first AABB overlap (which always sits on the
      // perimeter and would always score 1 pt).
      const dx = s.x - this.board.x;
      const dy = s.y - this.board.y;
      const dist = Math.hypot(dx, dy);
      const boardRadius = this.board.displayHeight / 2;
      const outerR = boardRadius * CFG.ringRadii.outer;
      if (dist <= outerR) {
        if (!this.spikeInsideBoard) {
          this.spikeInsideBoard = true;
          this.spikeMinDist = dist;
          this.spikeMinPoint.set(s.x, s.y);
        } else if (dist <= this.spikeMinDist) {
          this.spikeMinDist = dist;
          this.spikeMinPoint.set(s.x, s.y);
        } else {
          // Distance increasing → we just passed the closest point. Score now.
          this.scoreHit(this.spikeMinDist / boardRadius);
          return;
        }
      }

      if (s.x < -60 || s.x > width + 60 || s.y > height + 60) {
        s.destroy();
        this.spike = null;
        sfx.miss();
        this.tryFinishOnEmpty();
      }
    }
  }

  // ----- Setup helpers -----

  private setupPlayer(): void {
    const { width, height } = this.scale;
    const playerY = height - CFG.floorPadding - CFG.playerSize / 2;
    this.player = this.physics.add.sprite(width * 0.22, playerY, 'character');
    this.player.setScale(CFG.playerSize / this.player.height);
    this.player.setFlipX(false);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
  }

  private setupBoard(): void {
    const { width, height } = this.scale;
    this.boardBaseY = height * CFG.boardYFraction;
    this.board = this.physics.add.sprite(width * CFG.boardDistances[0], this.boardBaseY, 'dartboard');
    const body = this.board.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
  }

  private setupOverlays(): void {
    this.trajectory = this.add.graphics().setDepth(5);
    this.slingLine = this.add.graphics().setDepth(4);
  }

  private setupInput(): void {
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);

    const kb = this.input.keyboard!;
    kb.on('keydown-SPACE', this.handleKeyboardCharge, this);
    kb.on('keyup-SPACE', this.handleKeyboardRelease, this);
    kb.on('keydown-UP', () => {
      this.keyboardAim.angleDeg = Math.max(-85, this.keyboardAim.angleDeg - 4);
    });
    kb.on('keydown-DOWN', () => {
      this.keyboardAim.angleDeg = Math.min(-5, this.keyboardAim.angleDeg + 4);
    });
    kb.on('keydown-RIGHT', () => {
      this.keyboardAim.power = Math.min(1, this.keyboardAim.power + 0.05);
    });
    kb.on('keydown-LEFT', () => {
      this.keyboardAim.power = Math.max(0.15, this.keyboardAim.power - 0.05);
    });
  }

  private setupHud(): void {
    const { width } = this.scale;
    this.scoreText = this.add.text(16, 16, `Score: 0 / ${CFG.passThreshold}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#f7c948',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(10);

    this.quiverText = this.add.text(16, 46, `Cacti: ${this.quiverRemaining}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#9efc9b',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(10);

    this.timeText = this.add.text(width - 16, 16, 'Time: 0.0s', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#f3efe0',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);
  }

  private updateQuiverText(): void {
    this.quiverText.setText(`Cacti: ${this.quiverRemaining}`);
    if (this.quiverRemaining <= 3 && this.quiverRemaining > 0) {
      this.quiverText.setColor('#f7c948');
    } else if (this.quiverRemaining <= 0) {
      this.quiverText.setColor('#d24a3a');
    }
  }

  // ----- Input handlers -----

  private handlePointerDown(p: Phaser.Input.Pointer): void {
    if (this.finished || this.spike || this.dragging || this.quiverRemaining <= 0) return;
    this.dragging = true;
    this.dragPointerId = p.id;
    // Anchor the swipe at the touch point — the throw will fly in the direction
    // and distance the player swipes from here.
    this.dragStart.set(p.x, p.y);
    this.dragCurrent.set(p.x, p.y);
  }

  private handlePointerMove(p: Phaser.Input.Pointer): void {
    if (!this.dragging || p.id !== this.dragPointerId) return;
    this.dragCurrent.set(p.x, p.y);
  }

  private handlePointerUp(p: Phaser.Input.Pointer): void {
    if (!this.dragging || p.id !== this.dragPointerId) return;
    this.dragging = false;
    this.dragPointerId = null;
    this.dragCurrent.set(p.x, p.y);
    const drag = Phaser.Math.Distance.Between(
      this.dragStart.x, this.dragStart.y, this.dragCurrent.x, this.dragCurrent.y,
    );
    this.trajectory.clear();
    this.slingLine.clear();
    if (drag < CFG.minDragPx) return;
    const { vx, vy } = this.dragToVelocity();
    this.throwSpike(vx, vy);
  }

  private handleKeyboardCharge(): void {
    if (this.finished || this.spike || this.keyboardCharging || this.quiverRemaining <= 0) return;
    this.keyboardCharging = true;
  }

  private handleKeyboardRelease(): void {
    if (!this.keyboardCharging) return;
    this.keyboardCharging = false;
    this.trajectory.clear();
    const { vx, vy } = this.keyboardAimToVelocity();
    this.throwSpike(vx, vy);
  }

  // ----- Aim / velocity math -----

  private dragToVelocity(): { vx: number; vy: number } {
    // Swipe direction is the throw direction. Swipe right-and-up → spike flies
    // right-and-up. Power scales with swipe length (clamped to maxDragPx).
    let dx = this.dragCurrent.x - this.dragStart.x;
    let dy = this.dragCurrent.y - this.dragStart.y;
    const mag = Math.hypot(dx, dy);
    if (mag === 0) return { vx: 0, vy: 0 };
    const clamped = Math.min(mag, CFG.maxDragPx);
    dx = (dx / mag) * clamped;
    dy = (dy / mag) * clamped;
    let vx = dx * CFG.dragPowerScale;
    let vy = dy * CFG.dragPowerScale;
    const v = Math.hypot(vx, vy);
    if (v > CFG.maxThrowVelocity) {
      vx = (vx / v) * CFG.maxThrowVelocity;
      vy = (vy / v) * CFG.maxThrowVelocity;
    }
    return { vx, vy };
  }

  private keyboardAimToVelocity(): { vx: number; vy: number } {
    const a = (this.keyboardAim.angleDeg * Math.PI) / 180;
    const v = CFG.maxThrowVelocity * this.keyboardAim.power;
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v };
  }

  // ----- Drawing helpers -----

  private drawSwipeArrow(fromX: number, fromY: number, toX: number, toY: number): void {
    this.slingLine.clear();
    this.slingLine.lineStyle(3, 0xfff5b7, 0.6);
    this.slingLine.lineBetween(fromX, fromY, toX, toY);
    // Origin dot so the player sees where the swipe started.
    this.slingLine.fillStyle(0xfff5b7, 0.7);
    this.slingLine.fillCircle(fromX, fromY, 5);
  }

  private drawTrajectoryPreview(x0: number, y0: number, vx: number, vy: number): void {
    this.trajectory.clear();
    this.trajectory.fillStyle(CFG.previewDotColor, 0.85);
    let x = x0;
    let y = y0;
    let vyn = vy;
    const dt = CFG.previewDotIntervalMs / 1000;
    const { width, height } = this.scale;
    const dotCount = CFG.previewDotsMin + this.quiverRemaining;
    for (let i = 0; i < dotCount; i++) {
      vyn += CFG.gravityY * dt;
      x += vx * dt;
      y += vyn * dt;
      if (x < 0 || x > width || y > height) break;
      this.trajectory.fillCircle(x, y, CFG.previewDotRadius);
    }
  }

  // ----- Gameplay -----

  private throwSpike(vx: number, vy: number): void {
    if (this.spike || this.finished || this.quiverRemaining <= 0) return;
    this.quiverRemaining -= 1;
    this.updateQuiverText();
    sfx.throw();
    const s = this.physics.add.sprite(this.player.x, this.player.y, 'cactus.spike');
    s.setScale(CFG.spikeSize / s.height);
    s.setDepth(6);
    // Spike SVG natural orientation is tip-up; add +π/2 so it points along velocity.
    s.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
    const body = s.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    s.setVelocity(vx, vy);
    this.spike = s;
    this.spikeInsideBoard = false;
    this.spikeMinDist = Infinity;
  }

  private scoreHit(ratio: number): void {
    if (!this.spike || this.finished) return;
    const s = this.spike;

    let points: number = CFG.ringPoints.outer;
    let isBullseye = false;
    if (ratio <= CFG.ringRadii.bullseye) {
      points = CFG.ringPoints.bullseye;
      isBullseye = true;
    } else if (ratio <= CFG.ringRadii.middle) {
      points = CFG.ringPoints.middle;
    }

    // Snap to the deepest-penetration point so the spike visually lands there.
    s.x = this.spikeMinPoint.x;
    s.y = this.spikeMinPoint.y;
    s.setVelocity(0, 0);
    (s.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.spike = null;

    this.score += points;
    this.hitCount += 1;
    this.updateScoreText();
    this.showFloatingText(s.x, s.y, isBullseye ? `BULLSEYE +${points}` : `+${points}`);
    if (isBullseye) sfx.bullseye();
    else sfx.thunk();

    this.time.delayedCall(CFG.stickInMs, () => {
      if (s.active) s.destroy();
      if (!this.finished) {
        this.advanceBoard();
        this.checkPass();
        this.tryFinishOnEmpty();
      }
    });
  }

  private advanceBoard(): void {
    const { width, height } = this.scale;
    const idx = Math.min(this.hitCount, CFG.boardDistances.length - 1);
    const targetX = width * CFG.boardDistances[idx];
    const scale = Math.max(CFG.boardMinScale, Math.pow(CFG.boardShrinkPerHit, this.hitCount));
    this.boardBaseY = height * CFG.boardYFraction;
    this.tweens.add({
      targets: this.board,
      x: targetX,
      scale,
      duration: CFG.advanceTweenMs,
      ease: 'Cubic.easeOut',
    });
  }

  private updateScoreText(): void {
    if (this.passed) {
      this.scoreText.setText(`Score: ${this.score} ✓`);
    } else {
      this.scoreText.setText(`Score: ${this.score} / ${CFG.passThreshold}`);
    }
  }

  private showFloatingText(x: number, y: number, text: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#fff5b7',
      fontStyle: 'bold',
      stroke: '#7a4d0c',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 700,
      ease: 'Sine.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  private checkPass(): void {
    if (this.passed) return;
    if (this.score >= CFG.passThreshold) {
      this.markUnlocked();
    }
  }

  /**
   * Threshold reached mid-quiver — next level unlocked, but the player keeps
   * firing for bonus points until the quiver runs out. Mirrors level 1's
   * "keep going for bonus hits" pattern.
   */
  private markUnlocked(): void {
    this.passed = true;
    sfx.unlock();
    this.scoreText.setColor('#9efc9b');
    this.updateScoreText();

    const { width, height } = this.scale;
    const banner = this.add.text(width / 2, height / 2, 'Level Unlocked!\nKeep firing for bonus points', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '30px',
      color: '#fff5b7',
      fontStyle: 'bold',
      stroke: '#1f5a2d',
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
    this.time.delayedCall(1500, () => {
      if (!banner.active) return;
      this.tweens.add({
        targets: banner,
        alpha: 0,
        y: banner.y - 30,
        duration: 500,
        ease: 'Sine.easeIn',
        onComplete: () => banner.destroy(),
      });
    });
  }

  private tryFinishOnEmpty(): void {
    if (this.finished) return;
    if (this.quiverRemaining > 0) return;
    if (this.spike !== null) return; // wait for the last spike to resolve
    this.finish();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.trajectory.clear();
    this.slingLine.clear();
    const elapsedMs = this.time.now - this.startedAt;

    const { width, height } = this.scale;
    const text = this.passed
      ? `Cleared!\nFinal: ${this.score} pts`
      : `Out of cacti!\nScore: ${this.score}`;
    const color = this.passed ? '#9efc9b' : '#f7c948';
    const stroke = this.passed ? '#1f5a2d' : '#5a2d1f';
    if (!this.passed) sfx.pop();

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
