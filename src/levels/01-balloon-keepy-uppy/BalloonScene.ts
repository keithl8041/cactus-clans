import Phaser from 'phaser';
import { loadAsset } from '../../assets/loader';
import type { LevelContext } from '../types';
import { BALLOON_CONFIG as CFG } from './config';

export class BalloonScene extends Phaser.Scene {
  private readonly ctx: LevelContext;

  private balloon!: Phaser.Physics.Arcade.Sprite;
  private cactusGroup!: Phaser.Physics.Arcade.StaticGroup;
  private hitCount = 0;
  private startedAt = 0;
  private finished = false;
  private hitText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private spawnedCactuses = 0;

  constructor(ctx: LevelContext) {
    super({ key: 'BalloonScene' });
    this.ctx = ctx;
  }

  preload(): void {
    loadAsset(this, 'balloon', 'balloon', { color: this.ctx.clan.color, size: CFG.balloonSize });
    loadAsset(this, 'cactus.spike', 'cactus.spike', { height: CFG.cactusSize, width: CFG.cactusSize * 0.7 });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x16291c).setOrigin(0);
    // Sandy floor line for visual cue.
    this.add.rectangle(0, height - CFG.floorPadding, width, CFG.floorPadding, 0x7a5a3a).setOrigin(0);

    this.physics.world.gravity.y = CFG.baseGravity;

    this.balloon = this.physics.add.sprite(width / 2, height * 0.4, 'balloon');
    this.balloon.setCollideWorldBounds(true, 0.4, 0.4);
    this.balloon.setMaxVelocity(400, CFG.maxFallSpeed);
    this.balloon.setDamping(true);
    this.balloon.setDrag(0.7, 1);
    this.balloon.setInteractive({ useHandCursor: true });

    this.cactusGroup = this.physics.add.staticGroup();
    this.spawnCactus(width * 0.15, height - 60);
    this.spawnCactus(width * 0.5, height - 60);
    this.spawnCactus(width * 0.85, height - 60);

    this.physics.add.overlap(this.balloon, this.cactusGroup, () => this.fail('Pop! The balloon hit a cactus.'));

    // Floor death zone — separate from the visual sand strip.
    const floorY = height - CFG.floorPadding;
    this.events.on('postupdate', () => {
      if (this.finished) return;
      if (this.balloon.y + (this.balloon.displayHeight / 2) >= floorY) {
        this.fail('The balloon fell to the ground.');
      }
    });

    // Tap = impulse upward + horizontal nudge based on pointer offset.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.tap(p.x, p.y));

    // Spacebar fallback (desktop).
    this.input.keyboard?.on('keydown-SPACE', () => this.tap(this.balloon.x, this.balloon.y));

    this.hitText = this.add.text(16, 16, 'Hits: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#f7c948',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(10);

    this.timeText = this.add.text(width - 16, 16, 'Time: 0.0s', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#f3efe0',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);

    this.startedAt = this.time.now;
  }

  update(): void {
    if (this.finished) return;
    const elapsedMs = this.time.now - this.startedAt;
    this.timeText.setText(`Time: ${(elapsedMs / 1000).toFixed(1)}s`);
  }

  private tap(px: number, py: number): void {
    if (this.finished) return;
    const dx = this.balloon.x - px;
    const closeEnough = Phaser.Math.Distance.Between(px, py, this.balloon.x, this.balloon.y) < this.balloon.displayWidth * 0.9;
    if (!closeEnough) return;

    this.balloon.setVelocityY(CFG.tapImpulse);
    // Horizontal nudge: if tap is to the right of balloon, push balloon left, away.
    const nudge = Phaser.Math.Clamp(dx, -50, 50) / 50 * CFG.horizontalNudge;
    this.balloon.setVelocityX(this.balloon.body!.velocity.x * 0.5 + nudge);

    this.hitCount += 1;
    this.hitText.setText(`Hits: ${this.hitCount}`);

    // Ramp gravity, occasionally spawn an extra cactus.
    this.physics.world.gravity.y = Math.min(
      CFG.maxGravity,
      CFG.baseGravity + this.hitCount * CFG.gravityRampPerHit,
    );
    if (this.hitCount % CFG.cactusEvery === 0 && this.cactusGroup.getLength() < CFG.maxCactusCount) {
      const { width, height } = this.scale;
      const x = Phaser.Math.Between(60, width - 60);
      const y = Phaser.Math.Between(height * 0.35, height - 80);
      this.spawnCactus(x, y);
    }

    if (this.hitCount >= CFG.passThreshold) {
      this.win();
    }
  }

  private spawnCactus(x: number, y: number): void {
    const s = this.cactusGroup.create(x, y, 'cactus.spike') as Phaser.Physics.Arcade.Sprite;
    s.setOrigin(0.5, 1);
    s.refreshBody();
    // Shrink the collision body — the spike's visual triangle leaves dead air at the edges.
    const body = s.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(s.displayWidth * 0.5, s.displayHeight * 0.85);
    body.setOffset(s.displayWidth * 0.25, s.displayHeight * 0.1);
    this.spawnedCactuses += 1;
  }

  private win(): void {
    if (this.finished) return;
    this.finished = true;
    const elapsedMs = this.time.now - this.startedAt;
    this.showStatus(`Cleared! ${this.hitCount} hits in ${(elapsedMs / 1000).toFixed(1)}s`, '#f7c948');
    this.time.delayedCall(800, () => {
      this.ctx.onComplete({ passed: true, miniGamePoints: this.hitCount, elapsedMs });
    });
  }

  private fail(message: string): void {
    if (this.finished) return;
    this.finished = true;
    const elapsedMs = this.time.now - this.startedAt;
    this.balloon.setActive(false).setVisible(false);
    this.showStatus(message, '#d24a3a');
    this.time.delayedCall(1200, () => {
      this.ctx.onComplete({ passed: false, miniGamePoints: this.hitCount, elapsedMs });
    });
  }

  private showStatus(text: string, color: string): void {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color,
      fontStyle: 'bold',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: { x: 16, y: 12 },
      align: 'center',
    }).setOrigin(0.5).setDepth(20);
  }
}
