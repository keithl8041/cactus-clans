import Phaser from 'phaser';
import { loadAsset } from '../../assets/loader';
import { resolveCharacterKey } from '../../assets/manifest';
import { sfx } from '../../assets/sfx';
import type { LevelContext } from '../types';
import { DUNE_MAZE_CONFIG as CFG } from './config';
import { generateMap, type ParsedMap } from './maze';

interface QuicksandPatch {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
}

interface TrapEntity {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  revealed: boolean;
  revealing: boolean;
}

interface ArtifactEntity {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  collected: boolean;
}

interface TouchTarget {
  worldX: number;
  worldY: number;
  pointerId: number;
}

export class DuneMazeScene extends Phaser.Scene {
  private readonly ctx: LevelContext;

  private map!: ParsedMap;
  private player!: Phaser.Physics.Arcade.Sprite;
  private exitZone!: Phaser.GameObjects.Zone;
  private quicksandPatches: QuicksandPatch[] = [];
  private traps: TrapEntity[] = [];
  private artifacts: ArtifactEntity[] = [];

  private startedAt = 0;
  private timerMs = CFG.timerSeconds * 1000;
  private finished = false;
  private passed = false;
  private bonusPoints = 0;
  private artifactsCollected = 0;
  private currentlyOnQuicksand = false;
  private lastQuicksandExitAt = 0;
  private idleSince = 0;
  private lastBreadcrumbAt = 0;

  // Touch: the player accelerates toward this world point while held.
  private touchTarget: TouchTarget | null = null;
  private readonly touchStopRadius = CFG.tileSize * 0.35;

  // Keyboard
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  // HUD
  private timerText!: Phaser.GameObjects.Text;
  private artifactText!: Phaser.GameObjects.Text;
  private compass!: Phaser.GameObjects.Image;
  private statusBanner: Phaser.GameObjects.Text | null = null;

  constructor(ctx: LevelContext) {
    super({ key: 'DuneMazeScene' });
    this.ctx = ctx;
  }

  preload(): void {
    loadAsset(this, 'dune.floor', 'dune.floor');
    loadAsset(this, 'dune.wall', 'dune.wall');
    loadAsset(this, 'dune.quicksand', 'dune.quicksand', { size: CFG.quicksandSize });
    loadAsset(this, 'dune.trap', 'dune.trap', { size: CFG.trapSize });
    loadAsset(this, 'dune.exit', 'dune.exit', { size: CFG.tileSize });
    loadAsset(this, 'dune.artifact.1', 'dune.artifact.1');
    loadAsset(this, 'dune.artifact.2', 'dune.artifact.2');
    loadAsset(this, 'dune.artifact.3', 'dune.artifact.3');
    loadAsset(this, 'dune.breadcrumb', 'dune.breadcrumb');
    loadAsset(this, 'dune.compass', 'dune.compass');
    loadAsset(this, 'character', resolveCharacterKey(this.ctx.clan.name, this.ctx.formNumber), {
      clanColor: this.ctx.clan.color,
      formNumber: this.ctx.formNumber,
      size: CFG.playerSize,
    });
  }

  create(): void {
    this.map = generateMap();

    this.add.rectangle(0, 0, this.map.worldWidthPx, this.map.worldHeightPx, CFG.backgroundColor)
      .setOrigin(0)
      .setDepth(-1);

    // Floor tiled across the entire world. Phaser's TileSprite renders the
    // sand-grain texture repeated rather than scaling it up.
    this.add.tileSprite(
      this.map.worldWidthPx / 2,
      this.map.worldHeightPx / 2,
      this.map.worldWidthPx,
      this.map.worldHeightPx,
      'dune.floor',
    ).setDepth(0);

    this.physics.world.gravity.y = 0;
    this.physics.world.setBounds(0, 0, this.map.worldWidthPx, this.map.worldHeightPx);

    this.buildWalls();
    this.buildHazards();
    this.buildArtifacts();
    this.buildExit();
    this.buildPlayer();
    this.setupCamera();
    this.setupInput();
    this.setupHud();

    this.startedAt = this.time.now;
  }

  update(_time: number, delta: number): void {
    if (this.finished) return;

    // 1. Read input → desired direction
    const intent = this.readIntent();
    const accel = CFG.playerAccel;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (intent.x !== 0 || intent.y !== 0) {
      body.setAcceleration(intent.x * accel, intent.y * accel);
      this.idleSince = 0;
    } else {
      body.setAcceleration(0, 0);
      this.idleSince += delta;
    }

    // 2. Quicksand check (distance-based; bias the speed cap directly)
    const wasOnQuicksand = this.currentlyOnQuicksand;
    this.currentlyOnQuicksand = false;
    for (const patch of this.quicksandPatches) {
      const dx = this.player.x - patch.x;
      const dy = this.player.y - patch.y;
      if (Math.hypot(dx, dy) < CFG.tileSize * 0.55) {
        this.currentlyOnQuicksand = true;
        break;
      }
    }
    if (wasOnQuicksand && !this.currentlyOnQuicksand) {
      this.lastQuicksandExitAt = this.time.now;
    }
    const effectiveMax = CFG.playerMaxSpeed * (this.currentlyOnQuicksand ? CFG.quicksandSpeedMult : 1);
    body.setMaxVelocity(effectiveMax, effectiveMax);

    // 3. Timer tick (faster on quicksand)
    const drainMult = this.currentlyOnQuicksand ? CFG.quicksandTimerDrainMult : 1;
    this.timerMs -= delta * drainMult;
    if (this.timerMs <= 0) {
      this.fail('Out of time!');
      return;
    }
    this.timerText.setText(`Time: ${(this.timerMs / 1000).toFixed(1)}s`);
    this.timerText.setColor(this.currentlyOnQuicksand ? '#f7c948' : '#f3efe0');

    // 4. Trap reveal + collision
    const inGrace = this.time.now - this.lastQuicksandExitAt < CFG.trapPostQuicksandGraceMs;
    for (const trap of this.traps) {
      const dx = this.player.x - trap.x;
      const dy = this.player.y - trap.y;
      const d = Math.hypot(dx, dy);
      if (!trap.revealed && !trap.revealing && d < CFG.trapRevealRadius) {
        trap.revealing = true;
        this.tweens.add({
          targets: trap.sprite,
          alpha: 0.9,
          duration: CFG.trapRevealMs,
          onComplete: () => {
            trap.revealed = true;
            trap.revealing = false;
          },
        });
      }
      if (trap.revealed && !inGrace && d < CFG.trapSize * 0.45) {
        this.fail('Trip spike!');
        return;
      }
    }

    // 5. Artifact collection
    for (const a of this.artifacts) {
      if (a.collected) continue;
      const dx = this.player.x - a.x;
      const dy = this.player.y - a.y;
      if (Math.hypot(dx, dy) < CFG.artifactSize * 0.55) {
        a.collected = true;
        this.artifactsCollected += 1;
        this.bonusPoints += CFG.artifactBonusPoints;
        this.artifactText.setText(`Artifacts: ${this.artifactsCollected} / ${this.artifacts.length}`);
        sfx.star();
        this.tweens.add({
          targets: a.sprite,
          scale: a.sprite.scale * 1.6,
          alpha: 0,
          duration: 240,
        });
      }
    }

    // 6. Breadcrumbs
    if (intent.x !== 0 || intent.y !== 0) {
      if (this.time.now - this.lastBreadcrumbAt > CFG.breadcrumbIntervalMs) {
        this.lastBreadcrumbAt = this.time.now;
        const bc = this.add.image(this.player.x, this.player.y, 'dune.breadcrumb').setDepth(1);
        this.tweens.add({
          targets: bc,
          alpha: 0,
          duration: CFG.breadcrumbLifetimeMs,
          onComplete: () => bc.destroy(),
        });
      }
    }

    // 7. Compass (appears after idle)
    if (this.idleSince >= CFG.compassIdleMs) {
      const exitX = this.map.exit.col * CFG.tileSize + CFG.tileSize / 2;
      const exitY = this.map.exit.row * CFG.tileSize + CFG.tileSize / 2;
      const a = Math.atan2(exitY - this.player.y, exitX - this.player.x);
      this.compass.setVisible(true);
      this.compass.setRotation(a + Math.PI / 2);
      // Pin the compass above the player; the camera-follow keeps it on screen.
      this.compass.setPosition(this.player.x, this.player.y - 36);
    } else {
      this.compass.setVisible(false);
    }
  }

  // ----- World construction -----

  private buildWalls(): void {
    const group = this.physics.add.staticGroup();
    for (const rect of this.map.walls) {
      // TileSprite for visual repetition. Static physics rect aligned to it.
      const tile = this.add.tileSprite(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, 'dune.wall')
        .setDepth(2);
      const collider = this.add.zone(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h);
      this.physics.add.existing(collider, true);
      group.add(collider);
      // Tile is decorative only; the zone is the physics body.
      void tile;
    }
    // Player collides with the static group (set up after player is created in buildPlayer())
    this.staticWalls = group;
  }

  private staticWalls!: Phaser.Physics.Arcade.StaticGroup;

  private buildHazards(): void {
    const t = CFG.tileSize;
    for (const cell of this.map.quicksand) {
      const x = cell.col * t + t / 2;
      const y = cell.row * t + t / 2;
      const sprite = this.add.image(x, y, 'dune.quicksand').setDepth(2);
      sprite.setScale(CFG.quicksandSize / sprite.height);
      this.quicksandPatches.push({ sprite, x, y });
    }
    for (const cell of this.map.traps) {
      const x = cell.col * t + t / 2;
      const y = cell.row * t + t / 2;
      const sprite = this.add.image(x, y, 'dune.trap').setDepth(3);
      sprite.setScale(CFG.trapSize / sprite.height);
      sprite.setAlpha(0);
      this.traps.push({ sprite, x, y, revealed: false, revealing: false });
    }
  }

  private buildArtifacts(): void {
    const t = CFG.tileSize;
    const variants = ['dune.artifact.1', 'dune.artifact.2', 'dune.artifact.3'];
    this.map.artifacts.forEach((cell, i) => {
      const x = cell.col * t + t / 2;
      const y = cell.row * t + t / 2;
      const sprite = this.add.image(x, y, variants[i % variants.length]).setDepth(3);
      sprite.setScale(CFG.artifactSize / sprite.height);
      this.tweens.add({
        targets: sprite,
        y: y - 4,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.artifacts.push({ sprite, x, y, collected: false });
    });
  }

  private buildExit(): void {
    const t = CFG.tileSize;
    const x = this.map.exit.col * t + t / 2;
    const y = this.map.exit.row * t + t / 2;
    const sprite = this.add.image(x, y, 'dune.exit').setDepth(3);
    sprite.setScale(CFG.tileSize / sprite.height);
    this.exitZone = this.add.zone(x, y, t * 0.9, t * 0.9);
    this.physics.add.existing(this.exitZone, true);
  }

  private buildPlayer(): void {
    const t = CFG.tileSize;
    const x = this.map.spawn.col * t + t / 2;
    const y = this.map.spawn.row * t + t / 2;
    this.player = this.physics.add.sprite(x, y, 'character').setDepth(5);
    this.player.setScale(CFG.playerSize / this.player.height);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCollideWorldBounds(true);
    body.setMaxVelocity(CFG.playerMaxSpeed, CFG.playerMaxSpeed);
    body.setDrag(CFG.playerDrag, CFG.playerDrag);
    body.setSize(this.player.width * CFG.playerBodyScale, this.player.height * CFG.playerBodyScale);
    body.setOffset(
      this.player.width * (1 - CFG.playerBodyScale) / 2,
      this.player.height * (1 - CFG.playerBodyScale) / 2,
    );

    this.physics.add.collider(this.player, this.staticWalls);
    this.physics.add.overlap(this.player, this.exitZone, () => this.reachExit());
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.map.worldWidthPx, this.map.worldHeightPx);
    cam.startFollow(this.player, true, CFG.cameraLerp, CFG.cameraLerp);
    cam.setDeadzone(
      this.scale.width * CFG.cameraDeadzoneFrac,
      this.scale.height * CFG.cameraDeadzoneFrac,
    );
  }

  private setupInput(): void {
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  }

  private setupHud(): void {
    const { width } = this.scale;
    this.artifactText = this.add.text(16, 16, `Artifacts: 0 / ${this.artifacts.length}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#f7c948',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(20);

    this.timerText = this.add.text(width - 16, 16, `Time: ${CFG.timerSeconds.toFixed(1)}s`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#f3efe0',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(20);

    this.compass = this.add.image(0, 0, 'dune.compass').setDepth(15);
    this.compass.setAlpha(0.85);
    this.compass.setVisible(false);
  }

  // ----- Input handling -----

  private handlePointerDown(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    this.touchTarget = { worldX: wp.x, worldY: wp.y, pointerId: p.id };
  }

  private handlePointerMove(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    if (!p.isDown) return;
    if (!this.touchTarget || this.touchTarget.pointerId !== p.id) return;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    this.touchTarget.worldX = wp.x;
    this.touchTarget.worldY = wp.y;
  }

  private handlePointerUp(p: Phaser.Input.Pointer): void {
    if (this.touchTarget && this.touchTarget.pointerId === p.id) {
      this.touchTarget = null;
    }
  }

  private readIntent(): { x: number; y: number } {
    let kx = 0;
    let ky = 0;
    if (this.cursors.left?.isDown || this.keyA.isDown) kx -= 1;
    if (this.cursors.right?.isDown || this.keyD.isDown) kx += 1;
    if (this.cursors.up?.isDown || this.keyW.isDown) ky -= 1;
    if (this.cursors.down?.isDown || this.keyS.isDown) ky += 1;
    if (kx !== 0 || ky !== 0) {
      return { x: Math.sign(kx), y: Math.sign(ky) };
    }
    if (this.touchTarget) {
      const dx = this.touchTarget.worldX - this.player.x;
      const dy = this.touchTarget.worldY - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < this.touchStopRadius) return { x: 0, y: 0 };
      return { x: dx / dist, y: dy / dist };
    }
    return { x: 0, y: 0 };
  }

  // ----- End state -----

  private reachExit(): void {
    if (this.finished) return;
    this.passed = true;
    const timeBonus = Math.floor(this.timerMs / 1000) * CFG.timeBonusPerSecond;
    this.bonusPoints += timeBonus;
    sfx.unlock();
    this.finish(`Cleared!\n+${CFG.exitBaseReward} for exit · +${timeBonus} time · +${this.artifactsCollected * CFG.artifactBonusPoints} artifacts`);
  }

  private fail(reason: string): void {
    if (this.finished) return;
    this.passed = false;
    sfx.pop();
    this.finish(`${reason}\nArtifacts: ${this.artifactsCollected}`);
  }

  private finish(text: string): void {
    if (this.finished) return;
    this.finished = true;
    const { width, height } = this.scale;
    const color = this.passed ? '#9efc9b' : '#d24a3a';
    const stroke = this.passed ? '#1f5a2d' : '#5a2d1f';

    this.statusBanner = this.add.text(width / 2, height / 2, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color,
      fontStyle: 'bold',
      stroke,
      strokeThickness: 5,
      align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30).setAlpha(0);

    this.tweens.add({
      targets: this.statusBanner,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.6, to: 1 },
      duration: 280,
      ease: 'Back.easeOut',
    });

    const elapsedMs = Math.min(CFG.timerSeconds * 1000, this.time.now - this.startedAt);
    this.time.delayedCall(1400, () => {
      this.ctx.onComplete({
        passed: this.passed,
        miniGamePoints: this.passed ? CFG.exitBaseReward : 0,
        elapsedMs,
        bonusPoints: this.bonusPoints,
      });
    });
  }
}
