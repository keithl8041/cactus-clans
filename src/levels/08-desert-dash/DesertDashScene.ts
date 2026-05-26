import Phaser from 'phaser';
import { loadAsset } from '../../assets/loader';
import { resolveCharacterKey } from '../../assets/manifest';
import { sfx } from '../../assets/sfx';
import type { LevelContext } from '../types';
import { DESERT_DASH_CONFIG as CFG } from './config';

type ObstacleKind = 'rock' | 'cactus';

interface ObstacleEntity {
  sprite: Phaser.GameObjects.Image;
  worldX: number;
  kind: ObstacleKind;
  hit: boolean;
}

interface StarEntity {
  sprite: Phaser.GameObjects.Image;
  worldX: number;
  y: number;
  collected: boolean;
}

interface SpitEntity {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  spent: boolean;
}

type Phase = 'running' | 'bossIntro' | 'bossCycle' | 'bossDefeated' | 'outro' | 'ended';
type BossSubstate = 'idle' | 'telegraph' | 'leap' | 'landed' | 'returning' | 'spit';

interface ActivePointer {
  side: 'left' | 'right';
}

export class DesertDashScene extends Phaser.Scene {
  private readonly ctx: LevelContext;

  // ----- Phase / world state -----
  private phase: Phase = 'running';
  private distanceCovered = 0;
  private lives: number = CFG.startingLives;
  private bonusPoints = 0;
  private passed = false;
  private finished = false;
  private startedAt = 0;
  private hitPenaltyUntil = 0;
  private iframesUntil = 0;

  // ----- Player -----
  private player!: Phaser.Physics.Arcade.Sprite;
  private floor!: Phaser.GameObjects.Zone;
  private usedDoubleJump = false;
  private wasGrounded = true;

  // ----- Parallax -----
  private parallaxFar!: Phaser.GameObjects.TileSprite;
  private parallaxMid!: Phaser.GameObjects.TileSprite;
  private parallaxNear!: Phaser.GameObjects.TileSprite;

  // ----- Running-phase entities -----
  private obstacles: ObstacleEntity[] = [];
  private stars: StarEntity[] = [];
  private nextObstacleSpawnX = 0;
  private nextStarSpawnX = 0;

  // ----- Boss -----
  private boss: Phaser.GameObjects.Image | null = null;
  private bossHp: number = CFG.bossHp;
  private bossSubstate: BossSubstate = 'idle';
  private bossSubstateUntil = 0;
  private bossAttackCount = 0;          // for alternating leap/spit
  private bossHomeX = 0;                // computed at runtime
  private bossGroundY = 0;
  private bossLeapStartX = 0;
  private bossLeapTargetX = 0;
  private bossLeapStartT = 0;
  private bossIframesUntil = 0;
  private spits: SpitEntity[] = [];

  // ----- Finish -----
  private finishBanner: Phaser.GameObjects.Image | null = null;

  // ----- HUD -----
  private distText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private starText!: Phaser.GameObjects.Text;
  private heartIcons: Phaser.GameObjects.Text[] = [];
  private bossHealthBar!: Phaser.GameObjects.Graphics;
  private unlockBanner: Phaser.GameObjects.Text | null = null;
  private starCount = 0;

  // ----- Input -----
  private activePointers = new Map<number, ActivePointer>();
  private jumpButtonBg!: Phaser.GameObjects.Arc;
  private jumpButtonLabel!: Phaser.GameObjects.Text;
  private jumpButtonHit!: Phaser.Geom.Circle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  constructor(ctx: LevelContext) {
    super({ key: 'DesertDashScene' });
    this.ctx = ctx;
  }

  preload(): void {
    loadAsset(this, 'character', resolveCharacterKey(this.ctx.clan.name, this.ctx.formNumber), {
      clanColor: this.ctx.clan.color,
      formNumber: this.ctx.formNumber,
      size: CFG.playerSize,
    });
    loadAsset(this, 'cactus.spike', 'cactus.spike');
    loadAsset(this, 'rock', 'rock', { size: CFG.obstacleSize });
    loadAsset(this, 'star', 'star', { size: CFG.starSize });
    loadAsset(this, 'desert.parallax.far', 'desert.parallax.far');
    loadAsset(this, 'desert.parallax.mid', 'desert.parallax.mid');
    loadAsset(this, 'desert.parallax.near', 'desert.parallax.near');
    loadAsset(this, 'finishBanner', 'finishBanner', { size: 220 });
    loadAsset(this, 'tarantula', 'tarantula', { size: CFG.bossSize });
    loadAsset(this, 'boss.spike', 'cactus.spike');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, CFG.backgroundColor).setOrigin(0);

    this.physics.world.gravity.y = CFG.gravity;

    this.setupParallax();
    this.setupFloor();
    this.setupPlayer();
    this.setupHud();
    this.setupInput();
    this.setupJumpButton();

    this.bossHomeX = width * CFG.bossArenaXFraction;
    this.bossGroundY = height - CFG.floorPaddingPx - CFG.bossGroundYOffset - CFG.bossSize / 2;

    this.nextObstacleSpawnX = CFG.obstacleWarmupPx;
    this.nextStarSpawnX = CFG.starWarmupPx;

    this.startedAt = this.time.now;
  }

  update(_time: number, delta: number): void {
    if (this.finished) return;
    const dt = delta / 1000;
    const elapsed = this.time.now - this.startedAt;

    // Hard timeout (shouldn't normally trigger — boss phase is the long pole)
    if (elapsed >= CFG.courseTimeLimitMs && this.phase !== 'ended') {
      this.finishLevel('Time\'s up.');
      return;
    }

    switch (this.phase) {
      case 'running':
        this.updateRunning(dt);
        break;
      case 'bossIntro':
        this.updateBossIntro();
        break;
      case 'bossCycle':
        this.updateBossCycle(dt);
        break;
      case 'bossDefeated':
        // Just wait; transition is scheduled by time.delayedCall in defeatBoss().
        break;
      case 'outro':
        this.updateOutro(dt);
        break;
      case 'ended':
        break;
    }

    // Reset double-jump availability when grounded (any phase that uses physics).
    if (this.phase !== 'ended') {
      const grounded = this.isGrounded();
      if (grounded && !this.wasGrounded) {
        this.usedDoubleJump = false;
      }
      this.wasGrounded = grounded;
    }

    // HUD common updates
    this.timeText.setText(`Time: ${((CFG.courseTimeLimitMs - elapsed) / 1000).toFixed(1)}s`);
  }

  // ----- Setup -----

  private setupParallax(): void {
    const { width, height } = this.scale;
    const skyH = height * CFG.skyHeightFraction;
    this.parallaxFar = this.add.tileSprite(width / 2, skyH * 0.40, width, skyH * 0.5, 'desert.parallax.far').setDepth(1);
    this.parallaxMid = this.add.tileSprite(width / 2, skyH * 0.65, width, skyH * 0.6, 'desert.parallax.mid').setDepth(2);
    this.add.rectangle(0, skyH, width, height - skyH, CFG.groundColor).setOrigin(0).setDepth(3);
    this.parallaxNear = this.add.tileSprite(
      width / 2,
      skyH + (height - skyH) * 0.20,
      width,
      (height - skyH) * 0.6,
      'desert.parallax.near',
    ).setDepth(4);
  }

  private setupFloor(): void {
    const { width, height } = this.scale;
    const floorTop = height - CFG.floorPaddingPx;
    this.floor = this.add.zone(width / 2, floorTop, width, 4);
    this.physics.add.existing(this.floor, true);
  }

  private setupPlayer(): void {
    const { width, height } = this.scale;
    const x = width * CFG.playerXFraction;
    const spawnY = height - CFG.floorPaddingPx - CFG.playerSize / 2;
    this.player = this.physics.add.sprite(x, spawnY, 'character').setDepth(9);
    this.player.setScale(CFG.playerSize / this.player.height);
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(CFG.bossPlayerMoveSpeed * 1.5, CFG.playerMaxFallSpeed);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.player.width * 0.55, this.player.height * 0.85);
    body.setOffset(this.player.width * 0.225, this.player.height * 0.1);
    this.physics.add.collider(this.player, this.floor);
  }

  private setupHud(): void {
    const { width } = this.scale;

    this.distText = this.add.text(16, 16, 'Distance: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#f7c948',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(15);

    this.starText = this.add.text(16, 44, '★ 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#fff5b7',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(15);

    this.timeText = this.add.text(width - 16, 16, 'Time: --', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#f3efe0',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(15);

    // Hearts row in top-right under the timer
    for (let i = 0; i < CFG.startingLives; i++) {
      const heart = this.add.text(width - 16 - i * 28, 46, '♥', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#ff6b6b',
        fontStyle: 'bold',
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(15);
      this.heartIcons.push(heart);
    }

    this.bossHealthBar = this.add.graphics().setScrollFactor(0).setDepth(15);
  }

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
    kb.on('keydown-SPACE', () => this.tryJump());
    kb.on('keydown-UP', () => this.tryJump());
    kb.on('keydown-W', () => this.tryJump());
  }

  private setupJumpButton(): void {
    const { width, height } = this.scale;
    const r = CFG.jumpButtonRadius;
    const cx = width - CFG.jumpButtonMargin - r;
    const cy = height - CFG.floorPaddingPx - CFG.jumpButtonMargin - r;

    this.jumpButtonBg = this.add.circle(cx, cy, r, 0xf7c948, 0.85)
      .setStrokeStyle(3, 0x7a4d0c)
      .setScrollFactor(0)
      .setDepth(20);
    this.jumpButtonLabel = this.add.text(cx, cy, '↑', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '42px',
      color: '#3d2a07',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(21);

    this.jumpButtonHit = new Phaser.Geom.Circle(cx, cy, r + 10);
  }

  // ----- Input handlers -----

  private handlePointerDown(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    if (Phaser.Geom.Circle.Contains(this.jumpButtonHit, p.x, p.y)) {
      this.pressJumpButton();
      this.tryJump();
      return;
    }
    // Only track steering touches during the boss phase (running phase has no left/right control)
    if (this.phase === 'bossCycle' || this.phase === 'bossIntro') {
      this.activePointers.set(p.id, {
        side: p.x < this.scale.width / 2 ? 'left' : 'right',
      });
    }
  }

  private handlePointerMove(p: Phaser.Input.Pointer): void {
    if (this.finished || !p.isDown) return;
    const entry = this.activePointers.get(p.id);
    if (!entry) return;
    entry.side = p.x < this.scale.width / 2 ? 'left' : 'right';
  }

  private handlePointerUp(p: Phaser.Input.Pointer): void {
    this.activePointers.delete(p.id);
  }

  private pressJumpButton(): void {
    this.tweens.killTweensOf(this.jumpButtonBg);
    this.tweens.killTweensOf(this.jumpButtonLabel);
    this.jumpButtonBg.setScale(0.88);
    this.jumpButtonLabel.setScale(0.88);
    this.tweens.add({
      targets: [this.jumpButtonBg, this.jumpButtonLabel],
      scale: 1,
      duration: 140,
      ease: 'Back.easeOut',
    });
  }

  // ----- Player physics helpers -----

  private isGrounded(): boolean {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    return body.blocked.down || body.touching.down;
  }

  private tryJump(): void {
    if (this.finished) return;
    if (this.phase === 'ended' || this.phase === 'bossDefeated') return;
    if (this.isGrounded()) {
      this.player.setVelocityY(CFG.jumpImpulse);
      this.usedDoubleJump = false;
      sfx.jump();
    } else if (!this.usedDoubleJump) {
      this.player.setVelocityY(CFG.doubleJumpImpulse);
      this.usedDoubleJump = true;
      sfx.jump();
      // Little spin to signal the second jump
      this.tweens.add({
        targets: this.player,
        angle: this.player.angle + 360,
        duration: 360,
        ease: 'Sine.easeOut',
        onComplete: () => this.player.setAngle(0),
      });
    }
  }

  // ----- Running phase -----

  private updateRunning(dt: number): void {
    const { width } = this.scale;
    const camelX = width * CFG.playerXFraction;

    // Compute speed (slows briefly after a hit)
    const progress = this.distanceCovered / CFG.runningDistancePx;
    const baseSpeed = Phaser.Math.Linear(CFG.baseSpeed, CFG.baseSpeedFinal, Math.min(1, progress));
    const hitActive = this.time.now < this.hitPenaltyUntil;
    const speed = baseSpeed * (hitActive ? CFG.hitSpeedMult : 1);
    const advance = speed * dt;
    this.distanceCovered = Math.min(CFG.runningDistancePx, this.distanceCovered + advance);

    // Parallax scroll
    this.parallaxFar.tilePositionX += advance * CFG.parallaxFarMult;
    this.parallaxMid.tilePositionX += advance * CFG.parallaxMidMult;
    this.parallaxNear.tilePositionX += advance * CFG.parallaxNearMult;

    // Reposition entities
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.sprite.x = o.worldX - this.distanceCovered + camelX;
      if (o.sprite.x < -120) {
        o.sprite.destroy();
        this.obstacles.splice(i, 1);
      }
    }
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      s.sprite.x = s.worldX - this.distanceCovered + camelX;
      if (s.sprite.x < -120 || s.collected) {
        s.sprite.destroy();
        this.stars.splice(i, 1);
      }
    }

    // Spawn ahead one screen
    while (this.nextObstacleSpawnX < this.distanceCovered + width + 200) {
      this.spawnObstacleAt(this.nextObstacleSpawnX);
      this.nextObstacleSpawnX += this.currentObstacleGap();
    }
    while (this.nextStarSpawnX < this.distanceCovered + width + 200) {
      this.spawnStarAt(this.nextStarSpawnX);
      const jitter = 1 + Phaser.Math.FloatBetween(-CFG.starSpawnJitter, CFG.starSpawnJitter);
      this.nextStarSpawnX += CFG.starSpawnEveryPx * jitter;
    }

    // Collision: obstacles (skip during iframes)
    const inIframes = this.time.now < this.iframesUntil;
    if (!inIframes) {
      for (const o of this.obstacles) {
        if (o.hit) continue;
        if (Math.abs(o.sprite.x - this.player.x) > CFG.obstacleColliderXPx) continue;
        if (Math.abs(o.sprite.y - this.player.y) > CFG.obstacleColliderYPx) continue;
        this.onObstacleHit(o);
        break;
      }
    }

    // Collision: stars
    for (const s of this.stars) {
      if (s.collected) continue;
      if (Phaser.Math.Distance.Between(s.sprite.x, s.sprite.y, this.player.x, this.player.y) <= CFG.starColliderRadiusPx) {
        this.onStarCollect(s);
      }
    }

    // HUD
    this.distText.setText(`Distance: ${Math.floor(this.distanceCovered / 100)}`);

    // Transition: end of running phase → boss arena
    if (this.distanceCovered >= CFG.runningDistancePx) {
      this.startBossIntro();
    }
  }

  private currentObstacleGap(): number {
    const progress = this.distanceCovered / CFG.runningDistancePx;
    return Phaser.Math.Linear(CFG.obstacleBaseGapPx, CFG.obstacleEndGapPx, Math.min(1, progress));
  }

  private spawnObstacleAt(worldX: number): void {
    const { height } = this.scale;
    const baseY = height - CFG.floorPaddingPx;
    const spawn = (wx: number) => {
      const kind: ObstacleKind = Math.random() < CFG.obstacleRockChance ? 'rock' : 'cactus';
      const texture = kind === 'rock' ? 'rock' : 'cactus.spike';
      const sprite = this.add.image(0, 0, texture).setDepth(7);
      sprite.setScale(CFG.obstacleSize / sprite.height);
      // Anchor sprite so its bottom rests on the floor strip top
      sprite.y = baseY - sprite.displayHeight / 2;
      this.obstacles.push({ sprite, worldX: wx, kind, hit: false });
    };
    spawn(worldX);
    if (Math.random() < CFG.obstaclePairChance) {
      spawn(worldX + CFG.obstaclePairSpacingPx);
    }
  }

  private spawnStarAt(worldX: number): void {
    const { height } = this.scale;
    const isHigh = Math.random() < CFG.starHighChance;
    const y = (isHigh ? CFG.starHighYFraction : CFG.starLowYFraction) * height;
    const sprite = this.add.image(0, y, 'star').setDepth(8);
    sprite.setScale(CFG.starSize / sprite.height);
    // Gentle bob tween
    this.tweens.add({
      targets: sprite,
      scale: { from: sprite.scale * 0.9, to: sprite.scale * 1.05 },
      angle: { from: -10, to: 10 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.stars.push({ sprite, worldX, y, collected: false });
  }

  private onObstacleHit(o: ObstacleEntity): void {
    o.hit = true;
    this.takeDamage();
    this.hitPenaltyUntil = this.time.now + CFG.hitSpeedPenaltyMs;
    sfx.pop();
    this.cameras.main.shake(150, 0.008);
    this.tweens.add({
      targets: o.sprite,
      alpha: 0,
      duration: 200,
    });
  }

  private onStarCollect(s: StarEntity): void {
    s.collected = true;
    this.starCount += 1;
    this.bonusPoints += CFG.starBonusPoints;
    this.starText.setText(`★ ${this.starCount}`);
    sfx.star();
    this.tweens.add({
      targets: s.sprite,
      scale: s.sprite.scale * 1.5,
      alpha: 0,
      duration: 220,
    });
  }

  private takeDamage(): void {
    if (this.time.now < this.iframesUntil) return;
    this.lives -= 1;
    this.iframesUntil = this.time.now + CFG.hitIframesMs;
    // Grey out leftmost remaining heart (index = lives, the next one to lose)
    const idx = this.lives;
    if (idx >= 0 && idx < this.heartIcons.length) {
      const h = this.heartIcons[idx];
      h.setColor('#5a5a5a');
      this.tweens.add({
        targets: h,
        scale: { from: 1, to: 0.7 },
        duration: 200,
        ease: 'Sine.easeIn',
      });
    }
    // Blink player
    this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 120,
      yoyo: true,
      repeat: Math.floor(CFG.hitIframesMs / 240),
      onComplete: () => this.player.setAlpha(1),
    });

    if (this.lives <= 0) {
      this.finishLevel('You took too many hits!');
    }
  }

  // ----- Boss phase -----

  private startBossIntro(): void {
    this.phase = 'bossIntro';
    const { width, height } = this.scale;

    // Show "Boss Incoming!" banner
    this.unlockBanner = this.add.text(width / 2, height * 0.32, 'BOSS INCOMING!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '36px',
      color: '#ff6b6b',
      fontStyle: 'bold',
      stroke: '#3a0a0a',
      strokeThickness: 6,
      align: 'center',
    }).setOrigin(0.5).setDepth(25).setAlpha(0);

    this.tweens.add({
      targets: this.unlockBanner,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.6, to: 1 },
      duration: 280,
      ease: 'Back.easeOut',
    });

    // Spawn boss off-screen right, skitter in
    this.boss = this.add.image(width + CFG.bossSize, this.bossGroundY, 'tarantula').setDepth(8);
    this.boss.setScale(CFG.bossSize / this.boss.height);

    this.tweens.add({
      targets: this.boss,
      x: this.bossHomeX,
      duration: CFG.bossIntroMs,
      ease: 'Cubic.easeOut',
    });

    // Subtle skitter wobble during intro
    this.tweens.add({
      targets: this.boss,
      angle: { from: -4, to: 4 },
      duration: 140,
      yoyo: true,
      repeat: Math.floor(CFG.bossIntroMs / 280),
    });

    sfx.pop();
    this.bossSubstate = 'idle';
    this.bossSubstateUntil = this.time.now + CFG.bossIntroMs + 400;
    this.bossAttackCount = 0;

    this.time.delayedCall(CFG.bossIntroMs + 400, () => {
      if (this.unlockBanner) {
        this.tweens.add({
          targets: this.unlockBanner,
          alpha: 0,
          y: this.unlockBanner.y - 30,
          duration: 400,
          onComplete: () => {
            this.unlockBanner?.destroy();
            this.unlockBanner = null;
          },
        });
      }
      this.phase = 'bossCycle';
      this.startNextBossAttack();
    });
  }

  private updateBossIntro(): void {
    // Allow player to move + jump during the intro so they can position themselves.
    this.applyBossPhaseMovement();
    this.redrawBossHealthBar();
    this.distText.setText(`Distance: ${Math.floor(this.distanceCovered / 100)}`);
  }

  private updateBossCycle(dt: number): void {
    this.applyBossPhaseMovement();
    this.advanceBossState();
    this.advanceSpits(dt);
    this.checkBossContacts();
    this.redrawBossHealthBar();
    this.distText.setText(`Distance: ${Math.floor(this.distanceCovered / 100)}`);
  }

  private applyBossPhaseMovement(): void {
    let leftPressed = false;
    let rightPressed = false;
    for (const e of this.activePointers.values()) {
      if (e.side === 'left') leftPressed = true;
      else rightPressed = true;
    }
    const left = leftPressed || this.cursors.left?.isDown || this.keyA.isDown;
    const right = rightPressed || this.cursors.right?.isDown || this.keyD.isDown;

    if (left && !right) {
      this.player.setVelocityX(-CFG.bossPlayerMoveSpeed);
      this.player.setFlipX(true);
    } else if (right && !left) {
      this.player.setVelocityX(CFG.bossPlayerMoveSpeed);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    // Clamp player to boss-arena bounds.
    const { width } = this.scale;
    const minX = width * CFG.bossPlayerMinXFraction;
    const maxX = width * CFG.bossPlayerMaxXFraction;
    if (this.player.x < minX) this.player.x = minX;
    if (this.player.x > maxX) this.player.x = maxX;
  }

  private startNextBossAttack(): void {
    if (!this.boss || this.phase !== 'bossCycle') return;
    // Alternate leap and spit for variety; first attack is a leap.
    const kind = this.bossAttackCount % 2 === 0 ? 'leap' : 'spit';
    this.bossAttackCount += 1;
    this.bossSubstate = 'telegraph';
    this.bossSubstateUntil = this.time.now + CFG.bossTelegraphMs;

    // Visual telegraph: rear up (scale Y up briefly + tint)
    this.tweens.killTweensOf(this.boss);
    this.boss.setAngle(0);
    const baseScale = this.boss.scale;
    this.tweens.add({
      targets: this.boss,
      scaleY: baseScale * 1.18,
      scaleX: baseScale * 0.92,
      duration: CFG.bossTelegraphMs * 0.5,
      yoyo: true,
      onComplete: () => {
        if (!this.boss) return;
        this.boss.setScale(baseScale);
        if (kind === 'leap') this.beginBossLeap();
        else this.beginBossSpit();
      },
    });
  }

  private beginBossLeap(): void {
    if (!this.boss) return;
    this.bossSubstate = 'leap';
    this.bossSubstateUntil = this.time.now + CFG.bossLeapMs;
    this.bossLeapStartT = this.time.now;
    this.bossLeapStartX = this.boss.x;
    // Aim landing slightly off the player's current x for variety; clamp to arena.
    const targetX = Phaser.Math.Clamp(
      this.player.x + Phaser.Math.Between(-40, 40),
      this.scale.width * 0.15,
      this.scale.width * 0.45,
    );
    this.bossLeapTargetX = targetX;
  }

  private beginBossSpit(): void {
    if (!this.boss) return;
    this.bossSubstate = 'spit';
    // The spit IS the attack — there's no landed phase after it.
    this.bossSubstateUntil = this.time.now + CFG.bossSpitMs;

    const sprite = this.add.image(this.boss.x - CFG.bossSize * 0.4, this.boss.y - CFG.bossSize * 0.2, 'boss.spike').setDepth(8);
    sprite.setScale(CFG.bossSpitSize / sprite.height);
    sprite.setAngle(-90); // point leftward (the cactus.spike points up by default; -90 rotates it left)
    this.spits.push({ sprite, vx: -CFG.bossSpitSpeed, spent: false });
    sfx.throw();

    // After the spit travels, return to home and queue next attack.
    this.time.delayedCall(CFG.bossSpitMs, () => {
      if (this.phase !== 'bossCycle') return;
      this.startNextBossAttack();
    });
  }

  private advanceBossState(): void {
    if (!this.boss) return;

    if (this.bossSubstate === 'leap') {
      const t = Phaser.Math.Clamp((this.time.now - this.bossLeapStartT) / CFG.bossLeapMs, 0, 1);
      const x = Phaser.Math.Linear(this.bossLeapStartX, this.bossLeapTargetX, t);
      // Parabolic arc: peak at t=0.5
      const arc = -CFG.bossLeapPeakOffsetPx * 4 * t * (1 - t);
      this.boss.x = x;
      this.boss.y = this.bossGroundY + arc;
      // Tilt during leap
      this.boss.setAngle(t < 0.5 ? -8 : 8);
      if (t >= 1) {
        this.boss.y = this.bossGroundY;
        this.boss.setAngle(0);
        this.bossSubstate = 'landed';
        this.bossSubstateUntil = this.time.now + CFG.bossLandHoldMs;
        this.cameras.main.shake(180, 0.012);
        sfx.pop();
      }
    } else if (this.bossSubstate === 'landed') {
      if (this.time.now >= this.bossSubstateUntil) {
        // Return to home
        this.bossSubstate = 'returning';
        this.bossSubstateUntil = this.time.now + CFG.bossReturnMs;
        this.tweens.killTweensOf(this.boss);
        this.tweens.add({
          targets: this.boss,
          x: this.bossHomeX,
          y: this.bossGroundY,
          duration: CFG.bossReturnMs,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            if (this.phase === 'bossCycle') this.startNextBossAttack();
          },
        });
      }
    }
    // 'spit' and 'telegraph' transition via delayedCall / yoyo onComplete; nothing per-frame here.
  }

  private advanceSpits(dt: number): void {
    for (let i = this.spits.length - 1; i >= 0; i--) {
      const s = this.spits[i];
      s.sprite.x += s.vx * dt;
      if (s.sprite.x < -100 || s.spent) {
        s.sprite.destroy();
        this.spits.splice(i, 1);
      }
    }
  }

  private checkBossContacts(): void {
    if (!this.boss) return;
    const inIframes = this.time.now < this.iframesUntil;
    const bossInvuln = this.time.now < this.bossIframesUntil;

    // Stomp check: only when boss is in 'landed' state, player is above, falling, and within x-tolerance.
    if (this.bossSubstate === 'landed' && !bossInvuln) {
      const dx = Math.abs(this.player.x - this.boss.x);
      const playerBottom = this.player.y + this.player.displayHeight * 0.4;
      const bossTop = this.boss.y - this.boss.displayHeight * 0.45;
      const dy = playerBottom - bossTop;
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      if (
        dx < CFG.bossStompXTolerancePx &&
        dy > -CFG.bossStompYThreshold &&
        dy < CFG.bossStompYThreshold &&
        body.velocity.y > CFG.bossStompPlayerVy
      ) {
        this.onBossStomp();
        return; // Skip contact damage same frame
      }
    }

    // Body-contact damage: only during leap or landed (excluding the stomp moment) or while the boss occupies a tile near player.
    if (!inIframes) {
      // Leap collision: player got hit by the airborne boss.
      if (this.bossSubstate === 'leap' || this.bossSubstate === 'landed') {
        const dx = Math.abs(this.player.x - this.boss.x);
        const dy = Math.abs(this.player.y - this.boss.y);
        if (dx < CFG.bossStompXTolerancePx * 0.9 && dy < CFG.bossSize * 0.5) {
          // If we get here in 'landed', the stomp check above already passed if it was going to.
          // So this counts as side-contact damage.
          this.takeDamage();
          this.hitPenaltyUntil = this.time.now + CFG.hitSpeedPenaltyMs;
          this.cameras.main.shake(120, 0.008);
          sfx.pop();
        }
      }

      // Spit collision
      for (const s of this.spits) {
        if (s.spent) continue;
        const d = Phaser.Math.Distance.Between(s.sprite.x, s.sprite.y, this.player.x, this.player.y);
        if (d < CFG.bossSpitColliderRadiusPx) {
          s.spent = true;
          this.takeDamage();
          sfx.pop();
          this.cameras.main.shake(120, 0.008);
        }
      }
    }
  }

  private onBossStomp(): void {
    if (!this.boss) return;
    this.bossHp -= 1;
    this.bossIframesUntil = this.time.now + CFG.bossDamageIframesMs;
    // Bounce the player up off the stomp
    this.player.setVelocityY(CFG.jumpImpulse * 0.85);
    this.usedDoubleJump = false; // refresh the air-jump on a successful stomp
    sfx.hit();
    this.cameras.main.shake(220, 0.014);

    // Flash boss
    this.tweens.add({
      targets: this.boss,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: Math.floor(CFG.bossDamageIframesMs / 200),
      onComplete: () => this.boss?.setAlpha(1),
    });

    if (this.bossHp <= 0) {
      this.defeatBoss();
    }
  }

  private redrawBossHealthBar(): void {
    if (this.phase !== 'bossCycle' && this.phase !== 'bossIntro') {
      this.bossHealthBar.clear();
      return;
    }
    const { width } = this.scale;
    const w = CFG.bossHealthBarWidthPx;
    const h = CFG.bossHealthBarHeightPx;
    const x = width / 2 - w / 2;
    const y = CFG.bossHealthBarYPx;
    const g = this.bossHealthBar;
    g.clear();
    // Frame
    g.fillStyle(0x1a1a1a, 0.65);
    g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 5);
    g.fillStyle(0x3a1010, 1);
    g.fillRoundedRect(x, y, w, h, 3);
    const fillW = Math.max(0, (this.bossHp / CFG.bossHp) * (w - 4));
    g.fillStyle(0xff6b6b, 1);
    g.fillRoundedRect(x + 2, y + 2, fillW, h - 4, 2);
    // Label
    if (!this.bossLabelDrawn) {
      this.add.text(width / 2, y - 12, 'GIANT SAND TARANTULA', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#ffd5a8',
        fontStyle: 'bold',
      }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(15);
      this.bossLabelDrawn = true;
    }
  }
  private bossLabelDrawn = false;

  private defeatBoss(): void {
    this.phase = 'bossDefeated';
    this.passed = true;
    sfx.unlock();

    // Boss death tween: fall + spin off-screen
    if (this.boss) {
      this.tweens.killTweensOf(this.boss);
      const target = this.boss;
      this.tweens.add({
        targets: target,
        y: this.bossGroundY + 80,
        angle: 540,
        alpha: 0,
        duration: 900,
        ease: 'Cubic.easeIn',
        onComplete: () => target.destroy(),
      });
      this.boss = null;
    }
    // Clear any in-flight spits
    for (const s of this.spits) s.sprite.destroy();
    this.spits = [];

    // Banner
    const { width, height } = this.scale;
    const banner = this.add.text(width / 2, height * 0.36, 'BOSS DEFEATED!\nRun to the finish!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '32px',
      color: '#9efc9b',
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

    this.time.delayedCall(CFG.bossDefeatedDelayMs, () => {
      this.tweens.add({
        targets: banner,
        alpha: 0,
        y: banner.y - 24,
        duration: 400,
        onComplete: () => banner.destroy(),
      });
      this.startOutro();
    });
  }

  // ----- Outro (boss defeated → finish line) -----

  private startOutro(): void {
    this.phase = 'outro';
    // Snap player back to running x to resume the scrolling run.
    this.player.setVelocityX(0);
    this.activePointers.clear();
    this.tweens.add({
      targets: this.player,
      x: this.scale.width * CFG.playerXFraction,
      duration: 350,
      ease: 'Sine.easeInOut',
    });
  }

  private updateOutro(dt: number): void {
    const { width, height } = this.scale;
    const camelX = width * CFG.playerXFraction;

    const advance = CFG.baseSpeedFinal * dt;
    this.distanceCovered += advance;

    this.parallaxFar.tilePositionX += advance * CFG.parallaxFarMult;
    this.parallaxMid.tilePositionX += advance * CFG.parallaxMidMult;
    this.parallaxNear.tilePositionX += advance * CFG.parallaxNearMult;

    if (!this.finishBanner) {
      // Place finish banner one screen ahead of the player at start of outro
      this.finishBanner = this.add.image(width + 200, height * 0.42, 'finishBanner').setDepth(6);
      this.finishBanner.setScale(220 / this.finishBanner.height);
    }
    if (this.finishBanner) {
      this.finishBanner.x -= advance;
      if (this.finishBanner.x <= camelX) {
        this.finishLevel('Victory!');
        return;
      }
    }

    this.distText.setText(`Distance: ${Math.floor(this.distanceCovered / 100)}`);
  }

  // ----- End -----

  private finishLevel(messageHint: string): void {
    if (this.finished) return;
    this.finished = true;
    this.phase = 'ended';
    const elapsedMs = Math.min(CFG.courseTimeLimitMs, this.time.now - this.startedAt);
    const miniGamePoints = Math.floor(this.distanceCovered / 100);

    const { width, height } = this.scale;
    let text: string;
    let color: string;
    let stroke: string;
    if (this.passed) {
      text = `Victory!\n${miniGamePoints} pts · ${this.starCount} ★`;
      color = '#9efc9b';
      stroke = '#1f5a2d';
      sfx.unlock();
    } else {
      text = `${messageHint}\n${miniGamePoints} pts`;
      color = '#d24a3a';
      stroke = '#5a2d1f';
      sfx.pop();
    }
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

    this.time.delayedCall(1500, () => {
      this.ctx.onComplete({
        passed: this.passed,
        miniGamePoints,
        elapsedMs,
        bonusPoints: this.bonusPoints,
      });
    });
  }
}
