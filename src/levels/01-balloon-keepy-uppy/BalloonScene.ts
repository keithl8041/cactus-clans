import Phaser from 'phaser';
import { loadAsset } from '../../assets/loader';
import { sfx } from '../../assets/sfx';
import type { LevelContext } from '../types';
import { BALLOON_CONFIG as CFG } from './config';

type SpikeOrientation = 'up' | 'down' | 'left' | 'right';

interface ActivePointer {
  side: 'left' | 'right';
  downAt: number;
  downX: number;
  downY: number;
  moved: boolean;
}

export class BalloonScene extends Phaser.Scene {
  private readonly ctx: LevelContext;

  private balloon!: Phaser.Physics.Arcade.Sprite;
  private player!: Phaser.Physics.Arcade.Sprite;
  private floor!: Phaser.GameObjects.Zone;
  private floorSpikeGroup!: Phaser.Physics.Arcade.StaticGroup;
  private hazardSpikeGroup!: Phaser.Physics.Arcade.StaticGroup;
  private floorCactusXs: number[] = [];

  private hitCount = 0;
  private bonusPoints = 0;
  private startedAt = 0;
  private finished = false;
  private passed = false;
  private hitText!: Phaser.GameObjects.Text;
  private bonusText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;

  private star: Phaser.Physics.Arcade.Sprite | null = null;
  private starSpawnTimer?: Phaser.Time.TimerEvent;
  private starLifetimeTimer?: Phaser.Time.TimerEvent;
  private starTween?: Phaser.Tweens.Tween;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  // Pointer hold-zone state. Each active touch is tracked: which half it's
  // currently on (steers that direction), and whether it has moved/held long
  // enough to disqualify it as a tap (a quick tap fires `tryJump` on release).
  private activePointers = new Map<number, ActivePointer>();

  private lastHitAt = 0;
  private windTimer?: Phaser.Time.TimerEvent;
  private windResetTimer?: Phaser.Time.TimerEvent;

  constructor(ctx: LevelContext) {
    super({ key: 'BalloonScene' });
    this.ctx = ctx;
  }

  preload(): void {
    loadAsset(this, 'balloon', 'balloon', { color: this.ctx.clan.color, size: CFG.balloonSize });
    loadAsset(this, 'cactus.spike', 'cactus.spike', { height: CFG.cactusSize, width: CFG.cactusSize * 0.7 });
    loadAsset(this, 'character', 'character', {
      clanColor: this.ctx.clan.color,
      formNumber: this.ctx.formNumber,
      size: CFG.playerSize,
    });
    loadAsset(this, 'star', 'star', { size: CFG.starSize });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x16291c).setOrigin(0);
    this.add.rectangle(0, height - CFG.floorPadding, width, CFG.floorPadding, 0x7a5a3a).setOrigin(0);

    this.physics.world.gravity.y = CFG.baseGravity;

    // Invisible solid floor for the player to stand on (sits at the top of the sandy strip)
    const floorTop = height - CFG.floorPadding;
    this.floor = this.add.zone(width / 2, floorTop, width, 4);
    this.physics.add.existing(this.floor, true);

    this.setupPlayer();
    this.setupBalloon();
    this.setupSpikes();
    this.setupInput();
    this.setupHud();

    this.startedAt = this.time.now;
    this.scheduleWind();
    this.scheduleStar(CFG.starFirstDelayMs);
  }

  update(): void {
    if (this.finished) return;

    const elapsedMs = this.time.now - this.startedAt;
    this.timeText.setText(`Time: ${(elapsedMs / 1000).toFixed(1)}s`);

    // Movement: hold-zone touches and keyboard arrows feed the same left/right
    // intent. If both sides are held (left finger + right finger, or arrow keys
    // pressed against pointer hold) they cancel and ground drag decelerates us.
    let pointerLeft = false;
    let pointerRight = false;
    for (const entry of this.activePointers.values()) {
      if (entry.side === 'left') pointerLeft = true;
      else pointerRight = true;
    }
    const left = pointerLeft || this.cursors.left?.isDown || this.keyA.isDown;
    const right = pointerRight || this.cursors.right?.isDown || this.keyD.isDown;
    if (left && !right) {
      this.player.setVelocityX(-CFG.playerMaxSpeed);
    } else if (right && !left) {
      this.player.setVelocityX(CFG.playerMaxSpeed);
    }
    // No active input: ground drag (set on the body) decelerates the player naturally.
  }

  // ----- Setup helpers -----

  private setupPlayer(): void {
    const { width, height } = this.scale;
    const spawnY = height - CFG.floorPadding - CFG.playerSize / 2;
    this.player = this.physics.add.sprite(width / 2, spawnY, 'character');
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(CFG.playerMaxSpeed, CFG.playerMaxFallSpeed);
    this.player.setDragX(CFG.playerGroundDrag);
    // Shrink the body so the balloon can perch on the head without immediate re-overlap.
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.player.displayWidth * 0.6, this.player.displayHeight * 0.85);
    body.setOffset(this.player.displayWidth * 0.2, this.player.displayHeight * 0.1);
    this.physics.add.collider(this.player, this.floor);
  }

  private setupBalloon(): void {
    const { width, height } = this.scale;
    this.balloon = this.physics.add.sprite(width / 2, height * 0.3, 'balloon');
    this.balloon.setCollideWorldBounds(true, 0.85, 0.85);
    this.balloon.setMaxVelocity(400, CFG.maxFallSpeed);
    this.balloon.setDragX(20);
    // Balloon has its own gentle gravity (world gravity is for the player).
    const body = this.balloon.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setGravityY(CFG.balloonGravityY - CFG.baseGravity);
    // Slight body shrink for fairer hit detection.
    body.setSize(this.balloon.displayWidth * 0.85, this.balloon.displayHeight * 0.85);
    body.setOffset(this.balloon.displayWidth * 0.075, this.balloon.displayHeight * 0.075);

    // Player-balloon overlap = the hit
    this.physics.add.overlap(this.player, this.balloon, () => this.onPlayerHitsBalloon());

    // Balloon falls past the floor line = fail
    this.physics.add.overlap(this.balloon, this.floor, () => this.fail('The balloon hit the ground.'));
  }

  private setupSpikes(): void {
    const { width, height } = this.scale;
    this.floorSpikeGroup = this.physics.add.staticGroup();
    this.hazardSpikeGroup = this.physics.add.staticGroup();

    // Floor spikes — balloon-only hazards. Skip the center so the player doesn't spawn on one.
    const floorY = height - CFG.floorPadding;
    this.floorCactusXs = [width * 0.18, width * 0.82];
    this.spawnCactus(this.floorSpikeGroup, this.floorCactusXs[0], floorY, 'up');
    this.spawnCactus(this.floorSpikeGroup, this.floorCactusXs[1], floorY, 'up');

    this.physics.add.overlap(this.balloon, this.floorSpikeGroup, () => this.fail('Pop! The balloon hit a cactus.'));
    this.physics.add.overlap(this.balloon, this.hazardSpikeGroup, () => this.fail('Pop! The balloon hit a cactus.'));
    // Player passes through wall cacti freely — only the balloon pops on them.
    // Lets the player jump up to head the balloon over a cactus without dying.
  }

  private setupInput(): void {
    // Phaser starts with 2 pointers (mouse + one touch). Add 2 more so a player
    // can hold a steering finger AND tap-jump with another finger comfortably.
    this.input.addPointer(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.handlePointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.handlePointerMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.handlePointerUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.handlePointerUp(p));

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    kb.on('keydown-SPACE', () => this.tryJump());
    kb.on('keydown-UP', () => this.tryJump());
    kb.on('keydown-W', () => this.tryJump());
  }

  private setupHud(): void {
    const { width } = this.scale;
    this.hitText = this.add.text(16, 16, `Hits: 0 / ${CFG.passThreshold}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#f7c948',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(10);

    this.bonusText = this.add.text(16, 46, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#fff5b7',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(10);

    this.timeText = this.add.text(width - 16, 16, 'Time: 0.0s', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#f3efe0',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);
  }

  // ----- Input handlers -----

  private handlePointerDown(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    this.activePointers.set(p.id, {
      side: p.x < this.scale.width / 2 ? 'left' : 'right',
      downAt: this.time.now,
      downX: p.x,
      downY: p.y,
      moved: false,
    });
  }

  private handlePointerMove(p: Phaser.Input.Pointer): void {
    if (this.finished || !p.isDown) return;
    const entry = this.activePointers.get(p.id);
    if (!entry) return;
    const dx = Math.abs(p.x - entry.downX);
    const dy = Math.abs(p.y - entry.downY);
    if (!entry.moved && (dx > CFG.tapMoveThresholdPx || dy > CFG.tapMoveThresholdPx)) {
      entry.moved = true;
    }
    // Live re-evaluation of the side so the player can slide across the middle
    // line without lifting their finger.
    entry.side = p.x < this.scale.width / 2 ? 'left' : 'right';
  }

  private handlePointerUp(p: Phaser.Input.Pointer): void {
    const entry = this.activePointers.get(p.id);
    this.activePointers.delete(p.id);
    if (this.finished || !entry) return;
    const heldMs = this.time.now - entry.downAt;
    if (!entry.moved && heldMs < CFG.tapMaxMs) {
      this.tryJump();
    }
  }

  // ----- Gameplay -----

  private tryJump(): void {
    if (this.finished) return;
    if (!this.isGrounded()) return;
    this.player.setVelocityY(CFG.playerJumpImpulse);
    sfx.jump();
  }

  private isGrounded(): boolean {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    return body.blocked.down || body.touching.down;
  }

  private onPlayerHitsBalloon(): void {
    if (this.finished) return;
    if (this.time.now - this.lastHitAt < CFG.hitCooldownMs) return;
    this.lastHitAt = this.time.now;

    const halfWidth = this.player.displayWidth / 2;
    const offset = (this.balloon.x - this.player.x) / halfWidth;
    const clamped = Phaser.Math.Clamp(offset, -1, 1);
    const vx = clamped * CFG.balloonMaxBounceVX;

    let vy = CFG.balloonBounceVY;
    const playerVy = (this.player.body as Phaser.Physics.Arcade.Body).velocity.y;
    if (playerVy < -CFG.jumpBounceBoostThreshold) {
      vy += CFG.jumpBounceBonusVY;
    }

    this.balloon.setVelocity(vx, vy);
    // Snap above the player so we don't immediately re-overlap next frame.
    this.balloon.y = this.player.y - this.player.displayHeight / 2 - this.balloon.displayHeight / 2 - 2;

    this.hitCount += 1;
    this.updateHitText();
    sfx.hit();

    this.spawnDifficultySpikes();

    if (!this.passed && this.hitCount >= CFG.passThreshold) {
      this.markUnlocked();
    }
  }

  private updateHitText(): void {
    if (this.passed) {
      this.hitText.setText(`Hits: ${this.hitCount} ✓`);
    } else {
      this.hitText.setText(`Hits: ${this.hitCount} / ${CFG.passThreshold}`);
    }
  }

  /**
   * Threshold reached — next level is now unlocked, but the player keeps going
   * until the balloon pops. The unlock cue + a brief celebration overlay tell
   * them they're safe, then play continues. `passed` is stamped onto the final
   * result whenever they eventually fail.
   */
  private markUnlocked(): void {
    this.passed = true;
    sfx.unlock();
    this.updateHitText();
    this.hitText.setColor('#9efc9b');

    const { width, height } = this.scale;
    const banner = this.add.text(width / 2, height / 2, 'Level Unlocked!\nKeep going for bonus hits', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '34px',
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
    this.time.delayedCall(1700, () => {
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

  private spawnDifficultySpikes(): void {
    const { width, height } = this.scale;

    // Wall spikes sit in the lower half so the player can still jump high
    // enough to bat the balloon over them — at y < ~0.65*height the spikes are
    // above the player's peak jump and effectively unavoidable.
    if (this.hitCount === CFG.firstWallSpikeAt) {
      this.spawnCactus(this.hazardSpikeGroup, CFG.wallPadding, height * 0.72, 'right');
      this.spawnCactus(this.hazardSpikeGroup, width - CFG.wallPadding, height * 0.72, 'left');
    }
    if (this.hitCount > CFG.firstWallSpikeAt && (this.hitCount - CFG.firstWallSpikeAt) % CFG.spikeRampEvery === 0) {
      const sideLeft = this.hitCount % 2 === 0;
      const x = sideLeft ? CFG.wallPadding : width - CFG.wallPadding;
      const y = Phaser.Math.Between(Math.floor(height * 0.68), Math.floor(height * 0.82));
      this.spawnCactus(this.hazardSpikeGroup, x, y, sideLeft ? 'right' : 'left');
    }
  }

  private spawnCactus(
    group: Phaser.Physics.Arcade.StaticGroup,
    x: number,
    y: number,
    orientation: SpikeOrientation,
  ): void {
    const s = group.create(x, y, 'cactus.spike') as Phaser.Physics.Arcade.Sprite;
    switch (orientation) {
      case 'up':
        s.setOrigin(0.5, 1);
        s.setAngle(0);
        break;
      case 'down':
        s.setOrigin(0.5, 0);
        s.setAngle(180);
        break;
      case 'left':
        s.setOrigin(1, 0.5);
        s.setAngle(-90);
        break;
      case 'right':
        s.setOrigin(0, 0.5);
        s.setAngle(90);
        break;
    }
    s.refreshBody();
    const body = s.body as Phaser.Physics.Arcade.StaticBody;
    // For up/down the spike is narrow horizontally; for left/right it's narrow vertically.
    if (orientation === 'up' || orientation === 'down') {
      body.setSize(s.displayWidth * 0.5, s.displayHeight * 0.85);
      body.setOffset(s.displayWidth * 0.25, s.displayHeight * 0.1);
    } else {
      body.setSize(s.displayWidth * 0.85, s.displayHeight * 0.5);
      body.setOffset(s.displayWidth * 0.1, s.displayHeight * 0.25);
    }
  }

  // ----- Reward stars -----

  private scheduleStar(delayMs: number): void {
    if (this.finished) return;
    this.starSpawnTimer = this.time.delayedCall(delayMs, () => this.spawnStar());
  }

  private spawnStar(): void {
    if (this.finished || this.star || this.floorCactusXs.length === 0) {
      // already showing one or scene over — try again later
      if (!this.finished) this.scheduleStar(Phaser.Math.Between(CFG.starMinDelayMs, CFG.starMaxDelayMs));
      return;
    }
    const x = this.floorCactusXs[Phaser.Math.Between(0, this.floorCactusXs.length - 1)];
    const y = CFG.starTopOffset + CFG.starSize / 2;

    const s = this.physics.add.sprite(x, y, 'star');
    const body = s.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(s.displayWidth * 0.75, s.displayHeight * 0.75);
    body.setOffset(s.displayWidth * 0.125, s.displayHeight * 0.125);

    this.star = s;
    this.starTween = this.tweens.add({
      targets: s,
      scale: { from: 0.85, to: 1.05 },
      angle: { from: -8, to: 8 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.physics.add.overlap(this.balloon, s, () => this.collectStar());
    this.starLifetimeTimer = this.time.delayedCall(CFG.starLifetimeMs, () => this.despawnStar(false));
  }

  private collectStar(): void {
    if (this.finished || !this.star) return;
    this.bonusPoints += CFG.starBonusPoints;
    this.bonusText.setText(`★ Bonus: +${this.bonusPoints}`);
    this.showFloatingText(this.star.x, this.star.y, `+${CFG.starBonusPoints}`);
    sfx.star();
    this.despawnStar(true);
  }

  private despawnStar(collected: boolean): void {
    this.starLifetimeTimer?.remove();
    this.starLifetimeTimer = undefined;
    this.starTween?.stop();
    this.starTween = undefined;
    const s = this.star;
    this.star = null;
    if (s) {
      if (collected) {
        this.tweens.add({
          targets: s,
          scale: 1.6,
          alpha: 0,
          duration: 220,
          onComplete: () => s.destroy(),
        });
      } else {
        s.destroy();
      }
    }
    if (!this.finished) {
      this.scheduleStar(Phaser.Math.Between(CFG.starMinDelayMs, CFG.starMaxDelayMs));
    }
  }

  private showFloatingText(x: number, y: number, text: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
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

  // ----- Wind -----

  private scheduleWind(): void {
    if (this.finished) return;
    const delay = Phaser.Math.Between(CFG.windMinDelayMs, CFG.windMaxDelayMs);
    this.windTimer = this.time.delayedCall(delay, () => this.startGust());
  }

  private startGust(): void {
    if (this.finished) return;
    const intensity = Math.min(1, this.hitCount / CFG.windRampHits);
    if (intensity <= 0) {
      this.scheduleWind();
      return;
    }
    const sign = Math.random() < 0.5 ? -1 : 1;
    const magnitude = Phaser.Math.Between(CFG.windMinAccel, CFG.windMaxAccel) * intensity;
    const body = this.balloon.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.acceleration.x = sign * magnitude;

    this.windResetTimer = this.time.delayedCall(CFG.windGustMs, () => {
      if (this.finished) return;
      const b = this.balloon.body as Phaser.Physics.Arcade.Body | null;
      if (b) b.acceleration.x = 0;
      this.scheduleWind();
    });
  }

  // ----- End state -----

  /**
   * The only way a run ends — the balloon pops. If `passed` is set the player
   * already hit the threshold and the result screen shows "Cleared"; otherwise
   * it shows "Try again".
   */
  private fail(message: string): void {
    if (this.finished) return;
    this.finished = true;
    this.cancelTimers();
    sfx.pop();
    const elapsedMs = this.time.now - this.startedAt;
    this.balloon.setActive(false).setVisible(false);
    const headline = this.passed
      ? `${message}\nFinal: ${this.hitCount} hits`
      : message;
    this.showStatus(headline, this.passed ? '#f7c948' : '#d24a3a');
    this.time.delayedCall(1200, () => {
      this.ctx.onComplete({
        passed: this.passed,
        miniGamePoints: this.hitCount,
        elapsedMs,
        bonusPoints: this.bonusPoints,
      });
    });
  }

  private cancelTimers(): void {
    this.windTimer?.remove();
    this.windResetTimer?.remove();
    this.starSpawnTimer?.remove();
    this.starLifetimeTimer?.remove();
    this.starTween?.stop();
    if (this.star) {
      this.star.destroy();
      this.star = null;
    }
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
