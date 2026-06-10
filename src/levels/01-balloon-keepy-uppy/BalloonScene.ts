import Phaser from 'phaser';
import { loadAsset } from '../../assets/loader';
import { resolveBalloonKey, resolveCharacterKey } from '../../assets/manifest';
import { sfx } from '../../assets/sfx';
import type { LevelContext } from '../types';
import { BALLOON_CONFIG as CFG } from './config';

type SpikeOrientation = 'up' | 'down' | 'left' | 'right';

interface ActivePointer {
  side: 'left' | 'right';
  // y where this pointer first touched down. Used for swipe-up-to-jump:
  // once a finger has dragged up by `swipeUpJumpPx`, we fire a jump and
  // latch `jumped` so the same swipe doesn't repeat-jump as the finger
  // keeps moving up. A fresh tap (pointerdown) re-arms the gesture.
  startY: number;
  jumped: boolean;
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

  // Pointer hold-zone state. Each active touch is tracked by which half of the
  // screen it's currently on — that steers the player in that direction.
  // Jumping is a separate on-screen button (see `setupJumpButton`).
  private activePointers = new Map<number, ActivePointer>();
  private jumpButton!: Phaser.GameObjects.Image;
  private jumpButtonHit!: Phaser.Geom.Circle;

  private lastHitAt = 0;
  private windTimer?: Phaser.Time.TimerEvent;
  private windResetTimer?: Phaser.Time.TimerEvent;
  private timeoutTimer?: Phaser.Time.TimerEvent;

  constructor(ctx: LevelContext) {
    super({ key: 'BalloonScene' });
    this.ctx = ctx;
  }

  preload(): void {
    loadAsset(this, 'balloon', resolveBalloonKey(this.ctx.clan.name), {
      color: this.ctx.clan.color,
      size: CFG.balloonSize,
    });
    loadAsset(this, 'cactus.spike', 'cactus.spike');
    loadAsset(this, 'character', resolveCharacterKey(this.ctx.clan.name, this.ctx.formNumber), {
      clanColor: this.ctx.clan.color,
      formNumber: this.ctx.formNumber,
      size: CFG.playerSize,
    });
    loadAsset(this, 'star', 'star', { size: CFG.starSize });
    loadAsset(this, 'game8.jumpButton', 'game8.jumpButton');
    loadAsset(this, 'game1.background', 'game1.background');
    loadAsset(this, 'game1.floor', 'game1.floor');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.image(0, 0, 'game1.background').setOrigin(0).setDisplaySize(width, height);
    this.add.image(0, height - CFG.floorPadding, 'game1.floor')
      .setOrigin(0)
      .setDisplaySize(width, CFG.floorPadding);

    this.physics.world.gravity.y = CFG.baseGravity;

    // Invisible solid floor for the player to stand on. Sits inside the sandy
    // strip (not at its top) so feet plant into the floor art rather than
    // perching on its surface. `playerSink` drops the player a bit lower than
    // the cactus base line for a more grounded look.
    const groundY = height - CFG.floorPadding + CFG.groundLineOffset + CFG.playerSink;
    this.floor = this.add.zone(width / 2, groundY, width, 4);
    this.physics.add.existing(this.floor, true);

    this.setupPlayer();
    this.setupBalloon();
    this.setupSpikes();
    this.setupInput();
    this.setupHud();
    this.setupJumpButton();

    this.startedAt = this.time.now;
    this.scheduleWind();
    this.scheduleStar(CFG.starFirstDelayMs);
    this.timeoutTimer = this.time.delayedCall(CFG.timeLimitMs, () => this.handleTimeout());
  }

  update(): void {
    if (this.finished) return;

    const elapsedMs = this.time.now - this.startedAt;
    const remainingMs = Math.max(0, CFG.timeLimitMs - elapsedMs);
    this.timeText.setText(`Time: ${(remainingMs / 1000).toFixed(1)}s`);

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
      this.player.setFlipX(false);
    } else if (right && !left) {
      this.player.setVelocityX(CFG.playerMaxSpeed);
      this.player.setFlipX(true);
    }
    // No active input: ground drag (set on the body) decelerates the player naturally.
  }

  // ----- Setup helpers -----

  private setupPlayer(): void {
    const { width, height } = this.scale;
    const spawnY = height - CFG.floorPadding + CFG.groundLineOffset + CFG.playerSink - CFG.playerSize / 2;
    this.player = this.physics.add.sprite(width / 2, spawnY, 'character');
    // Scale to the configured player size while preserving aspect ratio. The
    // procedural SVG is already sized to fit, so this is ~no-op for the
    // fallback; the static-art PNGs (280×280) get downscaled to 96px tall.
    this.player.setScale(CFG.playerSize / this.player.height);
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(CFG.playerMaxSpeed, CFG.playerMaxFallSpeed);
    this.player.setDragX(CFG.playerGroundDrag);
    // Shrink the body so the balloon can perch on the head without immediate re-overlap.
    // setSize/setOffset are in texture pixels — Phaser applies the sprite's scale.
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.player.width * 0.6, this.player.height * 0.85);
    body.setOffset(this.player.width * 0.2, this.player.height * 0.1);
    this.physics.add.collider(this.player, this.floor);
  }

  private setupBalloon(): void {
    const { width, height } = this.scale;
    this.balloon = this.physics.add.sprite(width / 2, height * 0.3, 'balloon');
    this.balloon.setScale(CFG.balloonSize / this.balloon.height);
    this.balloon.setCollideWorldBounds(true, 0.85, 0.85);
    this.balloon.setMaxVelocity(400, CFG.maxFallSpeed);
    this.balloon.setDragX(20);
    // Balloon has its own gentle gravity (world gravity is for the player).
    const body = this.balloon.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setGravityY(CFG.balloonGravityY - CFG.baseGravity);
    // Slight body shrink for fairer hit detection. Texture pixels — Phaser scales.
    body.setSize(this.balloon.width * 0.85, this.balloon.height * 0.85);
    body.setOffset(this.balloon.width * 0.075, this.balloon.height * 0.075);

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
    const floorY = height - CFG.floorPadding + CFG.groundLineOffset;
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
    // can hold a steering finger AND press the jump button with another finger.
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

    this.timeText = this.add.text(width - 16, 16, `Time: ${(CFG.timeLimitMs / 1000).toFixed(1)}s`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#f3efe0',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);
  }

  private setupJumpButton(): void {
    const { width, height } = this.scale;
    const r = CFG.jumpButtonRadius;
    const cx = width - CFG.jumpButtonMargin - r;
    const cy = height - CFG.floorPadding - CFG.jumpButtonMargin - r;

    this.jumpButton = this.add.image(cx, cy, 'game8.jumpButton')
      .setScrollFactor(0)
      .setDepth(12);
    this.jumpButton.setDisplaySize(r * 2, r * 2);

    this.jumpButtonHit = new Phaser.Geom.Circle(cx, cy, r + 14);
  }

  // ----- Input handlers -----

  private handlePointerDown(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    // Jump button takes priority over steering hold-zones so a tap on the
    // button doesn't also drag the player toward that side.
    if (Phaser.Geom.Circle.Contains(this.jumpButtonHit, p.x, p.y)) {
      this.pressJumpButton();
      this.tryJump();
      return;
    }
    this.activePointers.set(p.id, {
      side: p.x < this.scale.width / 2 ? 'left' : 'right',
      startY: p.y,
      jumped: false,
    });
  }

  private handlePointerMove(p: Phaser.Input.Pointer): void {
    if (this.finished || !p.isDown) return;
    const entry = this.activePointers.get(p.id);
    if (!entry) return;
    // Live re-evaluation of the side so the player can slide across the middle
    // line without lifting their finger.
    entry.side = p.x < this.scale.width / 2 ? 'left' : 'right';
    // Swipe-up to jump: once this pointer has dragged up far enough, fire a
    // jump and drop the pointer from the steering map. One stroke does one
    // thing — the player lifts and re-places to steer again, so a jump
    // gesture never also drags the character sideways.
    if (!entry.jumped && entry.startY - p.y >= CFG.swipeUpJumpPx) {
      entry.jumped = true;
      this.activePointers.delete(p.id);
      this.tryJump();
    }
  }

  private handlePointerUp(p: Phaser.Input.Pointer): void {
    this.activePointers.delete(p.id);
  }

  private pressJumpButton(): void {
    this.tweens.killTweensOf(this.jumpButton);
    this.jumpButton.setScale(this.jumpButton.scaleX * 0.88, this.jumpButton.scaleY * 0.88);
    const baseX = this.jumpButton.scaleX / 0.88;
    const baseY = this.jumpButton.scaleY / 0.88;
    this.tweens.add({
      targets: this.jumpButton,
      scaleX: baseX,
      scaleY: baseY,
      duration: 140,
      ease: 'Back.easeOut',
    });
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
   * until the timer expires or the balloon pops. The unlock cue + a brief
   * celebration overlay tell them they're safe, then play continues for bonus
   * hits. `passed` is stamped onto the final result when the run ends.
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
    s.setScale(CFG.cactusSize / s.height);
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
    // setSize/setOffset use texture pixels — Phaser applies the sprite's scale.
    if (orientation === 'up' || orientation === 'down') {
      body.setSize(s.width * 0.5, s.height * 0.85);
      body.setOffset(s.width * 0.25, s.height * 0.1);
    } else {
      body.setSize(s.width * 0.85, s.height * 0.5);
      body.setOffset(s.width * 0.1, s.height * 0.25);
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

  private handleTimeout(): void {
    const message = this.passed ? 'Level cleared!' : "Time's up!";
    this.finish(message, false);
  }

  // ----- End state -----

  /**
   * Ends the run when the balloon pops or the countdown expires. If `passed` is
   * set the player already hit the threshold and the result screen shows the
   * successful final-hit summary; otherwise it shows the failure message.
   */
  private finish(message: string, playPopSound: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.cancelTimers();
    if (playPopSound) sfx.pop();
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

  private fail(message: string): void {
    this.finish(message, true);
  }

  private cancelTimers(): void {
    this.timeoutTimer?.remove();
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
