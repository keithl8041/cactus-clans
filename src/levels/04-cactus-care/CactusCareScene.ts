import Phaser from 'phaser';
import { loadAsset } from '../../assets/loader';
import { sfx } from '../../assets/sfx';
import type { LevelContext } from '../types';
import { CACTUS_CARE_CONFIG as CFG } from './config';

type EventKind = 'sun' | 'rain';

interface ActiveEvent {
  kind: EventKind;
  endsAt: number;
  overlay: Phaser.GameObjects.Image;
}

export class CactusCareScene extends Phaser.Scene {
  private readonly ctx: LevelContext;

  private cactus!: Phaser.GameObjects.Image;
  private can!: Phaser.GameObjects.Image;
  private canRestPos = new Phaser.Math.Vector2();

  private meter: number = CFG.meterStart;
  private displayedMeter: number = CFG.meterStart;
  private happyTimeMs = 0;
  private centerTimeMs = 0;
  private centerSecondsBanked = 0;
  private bonusPoints = 0;
  private passed = false;
  private finished = false;
  private startedAt = 0;

  private pointerActive = false;
  private activePointerId: number | null = null;
  private readonly pointerPos = new Phaser.Math.Vector2();
  private firstSampleAfterDown = false;

  // Wilt/drown countdowns
  private wiltCountdownStartAt: number | null = null;
  private drownCountdownStartAt: number | null = null;

  // Events
  private currentEvent: ActiveEvent | null = null;
  private nextEventTimer?: Phaser.Time.TimerEvent;
  private lastWaterChirpAt = 0;

  // Graphics
  private meterGfx!: Phaser.GameObjects.Graphics;
  private streamGfx!: Phaser.GameObjects.Graphics;

  // HUD
  private happyText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private bonusText!: Phaser.GameObjects.Text;
  private unlockBanner: Phaser.GameObjects.Text | null = null;

  // Keyboard (desktop)
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private virtualPointer = new Phaser.Math.Vector2();
  private virtualActive = false;

  constructor(ctx: LevelContext) {
    super({ key: 'CactusCareScene' });
    this.ctx = ctx;
  }

  preload(): void {
    loadAsset(this, 'cactus.pet', 'cactus.pet', {
      size: CFG.cactusSize,
      clanColor: this.ctx.clan.color,
    });
    loadAsset(this, 'wateringCan', 'wateringCan', { size: CFG.canSize });
    loadAsset(this, 'sunOverlay', 'sunOverlay');
    loadAsset(this, 'rainOverlay', 'rainOverlay');
    loadAsset(this, 'cactus.spike', 'cactus.spike');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, CFG.backgroundColor).setOrigin(0);

    this.setupScene();
    this.setupHud();
    this.setupInput();

    this.streamGfx = this.add.graphics().setDepth(6);
    this.meterGfx = this.add.graphics().setDepth(10);

    this.startedAt = this.time.now;
    this.scheduleNextEvent(CFG.firstEventDelayMs);
  }

  update(time: number, delta: number): void {
    if (this.finished) return;
    const dtSec = delta / 1000;
    const elapsed = time - this.startedAt;

    // Resolve current input pointer position (touch or virtual keyboard cursor).
    const inputActive = this.resolveInput(dtSec);

    // Lerp the can toward the active pointer; snap on first sample after pointerdown.
    if (inputActive) {
      const smoothing = this.firstSampleAfterDown ? 1 : CFG.canFollowSmoothing;
      this.can.x += (this.pointerPos.x - this.can.x) * smoothing;
      this.can.y += (this.pointerPos.y - this.can.y) * smoothing;
      this.firstSampleAfterDown = false;
    } else {
      // Lerp back to rest position
      this.can.x += (this.canRestPos.x - this.can.x) * 0.08;
      this.can.y += (this.canRestPos.y - this.can.y) * 0.08;
    }

    // Watering check (spout must be near cactus center, and a pointer must be active).
    const spoutX = this.can.x + CFG.canSpoutOffsetX;
    const spoutY = this.can.y + CFG.canSpoutOffsetY;
    const dist = Phaser.Math.Distance.Between(spoutX, spoutY, this.cactus.x, this.cactus.y);
    const watering = inputActive && dist <= CFG.cactusHitRadius;

    // Apply meter delta.
    const phase = this.currentPhase(elapsed);
    const decayMult =
      phase === 'late' ? CFG.decayMultLate : phase === 'mid' ? CFG.decayMultMid : 1;
    let meterDelta = watering ? CFG.waterRatePerSec : -CFG.baseDecayPerSec * decayMult;
    if (this.currentEvent?.kind === 'sun') meterDelta -= CFG.sunBlastDecayPerSec;
    if (this.currentEvent?.kind === 'rain') meterDelta += CFG.rainRisePerSec;
    this.meter = Phaser.Math.Clamp(this.meter + meterDelta * dtSec, CFG.meterMin, CFG.meterMax);

    // Smooth displayed value toward raw meter.
    this.displayedMeter += (this.meter - this.displayedMeter) * CFG.meterFollowSmoothing;

    // Compute current band based on phase.
    const { bandLow, bandHigh, bandCenter } = this.currentBand(phase);

    // Scoring uses the raw meter, not the displayed value.
    const inHappy = this.meter >= bandLow && this.meter <= bandHigh;
    if (inHappy) {
      this.happyTimeMs += delta;
      const inCenter =
        this.meter >= bandCenter - CFG.centerBandHalfWidth &&
        this.meter <= bandCenter + CFG.centerBandHalfWidth;
      if (inCenter) {
        this.centerTimeMs += delta;
        const banked = Math.floor(this.centerTimeMs / 1000);
        if (banked > this.centerSecondsBanked) {
          const gained = banked - this.centerSecondsBanked;
          this.centerSecondsBanked = banked;
          this.bonusPoints += gained * CFG.bonusPerCenterSec;
          this.bonusText.setText(`★ Bonus: +${this.bonusPoints}`);
        }
      }
    }

    // Wilt/drown grace timers
    if (this.meter <= 0.5) {
      if (this.wiltCountdownStartAt == null) this.wiltCountdownStartAt = time;
      if (time - this.wiltCountdownStartAt >= CFG.wiltGraceMs) {
        this.endRun('wilted');
        return;
      }
    } else this.wiltCountdownStartAt = null;

    if (this.meter >= CFG.meterMax - 0.5) {
      if (this.drownCountdownStartAt == null) this.drownCountdownStartAt = time;
      if (time - this.drownCountdownStartAt >= CFG.wiltGraceMs) {
        this.endRun('drowned');
        return;
      }
    } else this.drownCountdownStartAt = null;

    // Pass check
    const happySec = Math.floor(this.happyTimeMs / 1000);
    if (!this.passed && happySec >= CFG.passThreshold) this.markUnlocked();

    // End of survive window
    if (elapsed >= CFG.surviveMs) {
      this.endRun('survived');
      return;
    }

    // Water-stream chirp (throttled)
    if (watering && time - this.lastWaterChirpAt > 600) {
      this.lastWaterChirpAt = time;
      sfx.hit();
    }

    // HUD redraw
    this.redrawMeter(bandLow, bandHigh, bandCenter);
    this.redrawStream(watering, spoutX, spoutY);
    this.timeText.setText(`Time: ${((CFG.surviveMs - elapsed) / 1000).toFixed(1)}s`);
    this.happyText.setText(
      this.passed
        ? `Happy: ${happySec}s ✓`
        : `Happy: ${happySec}s / ${CFG.passThreshold}s`,
    );
  }

  // ----- Setup -----

  private setupScene(): void {
    const { width, height } = this.scale;

    // Decorative pot below the cactus.
    const potX = width * 0.4;
    const potY = height * 0.78;
    const potW = CFG.cactusSize * 0.85;
    const potH = CFG.cactusSize * 0.35;
    this.add.rectangle(potX, potY, potW * 1.05, potH * 0.20, 0xc9744a)
      .setStrokeStyle(2, 0x5a2d1f)
      .setDepth(2);
    this.add.rectangle(potX, potY + potH * 0.35, potW, potH * 0.7, 0x8a4624)
      .setStrokeStyle(2, 0x5a2d1f)
      .setDepth(2);

    // Pet cactus — large, friendly.
    this.cactus = this.add.image(potX, height * 0.50, 'cactus.pet').setDepth(3);
    this.cactus.setScale(CFG.cactusSize / this.cactus.height);

    // Watering can rests up-and-left of the cactus.
    this.canRestPos.set(potX - CFG.cactusSize * 0.6, height * 0.25);
    this.can = this.add.image(this.canRestPos.x, this.canRestPos.y, 'wateringCan').setDepth(5);
    this.can.setScale(CFG.canSize / this.can.height);
  }

  private setupHud(): void {
    const { width } = this.scale;

    this.happyText = this.add.text(16, 16, `Happy: 0s / ${CFG.passThreshold}s`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#f7c948',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(11);

    this.bonusText = this.add.text(16, 46, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#fff5b7',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(11);

    this.timeText = this.add.text(width - 16, 16, 'Time: 40.0s', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#f3efe0',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(11);
  }

  private setupInput(): void {
    this.input.addPointer(2);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Start the virtual pointer at the cactus so the first keyboard activation
    // doesn't fly across the screen.
    this.virtualPointer.copy(this.canRestPos);
  }

  // ----- Input handlers -----

  private handlePointerDown(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    if (this.activePointerId != null) return; // already tracking a pointer
    this.activePointerId = p.id;
    this.pointerPos.set(p.x, p.y);
    this.pointerActive = true;
    this.firstSampleAfterDown = true;
  }

  private handlePointerMove(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    if (p.id !== this.activePointerId) return;
    if (!p.isDown) return;
    this.pointerPos.set(p.x, p.y);
  }

  private handlePointerUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.activePointerId) return;
    this.activePointerId = null;
    this.pointerActive = false;
  }

  /**
   * Returns true if any pointer/keyboard input is currently driving the can.
   * Updates `pointerPos` to the active source.
   */
  private resolveInput(dtSec: number): boolean {
    if (this.pointerActive) return true;

    // Virtual pointer driven by arrows + Space.
    const keyboardSpeed = 360;
    const left = this.cursors.left?.isDown;
    const right = this.cursors.right?.isDown;
    const up = this.cursors.up?.isDown;
    const down = this.cursors.down?.isDown;
    if (left || right || up || down) {
      if (left) this.virtualPointer.x -= keyboardSpeed * dtSec;
      if (right) this.virtualPointer.x += keyboardSpeed * dtSec;
      if (up) this.virtualPointer.y -= keyboardSpeed * dtSec;
      if (down) this.virtualPointer.y += keyboardSpeed * dtSec;
      this.virtualPointer.x = Phaser.Math.Clamp(this.virtualPointer.x, 0, this.scale.width);
      this.virtualPointer.y = Phaser.Math.Clamp(this.virtualPointer.y, 0, this.scale.height);
    }
    if (this.keySpace.isDown) {
      if (!this.virtualActive) {
        this.virtualActive = true;
        this.firstSampleAfterDown = true;
      }
      this.pointerPos.copy(this.virtualPointer);
      return true;
    }
    this.virtualActive = false;
    return false;
  }

  // ----- Phase / band helpers -----

  private currentPhase(elapsedMs: number): 'easy' | 'mid' | 'late' {
    const frac = elapsedMs / CFG.surviveMs;
    if (frac >= CFG.difficultyLateStartPct) return 'late';
    if (frac >= CFG.difficultyMidStartPct) return 'mid';
    return 'easy';
  }

  private currentBand(phase: 'easy' | 'mid' | 'late'): {
    bandLow: number;
    bandHigh: number;
    bandCenter: number;
  } {
    const shrink =
      phase === 'late' ? CFG.bandShrinkLate : phase === 'mid' ? CFG.bandShrinkMid : 0;
    const halfShrink = shrink / 2;
    const bandLow = CFG.happyBandLow + halfShrink;
    const bandHigh = CFG.happyBandHigh - halfShrink;
    return { bandLow, bandHigh, bandCenter: (bandLow + bandHigh) / 2 };
  }

  // ----- Events -----

  private scheduleNextEvent(delayMs?: number): void {
    if (this.finished) return;
    const phase = this.currentPhase(this.time.now - this.startedAt);
    const mult =
      phase === 'late' ? CFG.eventDelayMultLate : phase === 'mid' ? CFG.eventDelayMultMid : 1;
    const delay = delayMs ?? Phaser.Math.Between(CFG.eventMinDelayMs, CFG.eventMaxDelayMs) * mult;
    this.nextEventTimer = this.time.delayedCall(delay, () => this.startEvent());
  }

  private startEvent(): void {
    if (this.finished) return;
    // If an event is already running, end it before starting the new one.
    if (this.currentEvent) this.endEvent();

    const kind: EventKind = Math.random() < 0.5 ? 'sun' : 'rain';
    const { width, height } = this.scale;
    const overlay = this.add.image(width / 2, height / 2, kind === 'sun' ? 'sunOverlay' : 'rainOverlay')
      .setDepth(7)
      .setAlpha(0);
    // Scale overlay to cover the full canvas (the SVG is square; cover via max axis).
    const cover = Math.max(width / overlay.width, height / overlay.height) * 1.1;
    overlay.setScale(cover);
    this.tweens.add({ targets: overlay, alpha: kind === 'sun' ? 0.55 : 0.7, duration: 350 });

    const duration = kind === 'sun' ? CFG.sunBlastDurationMs : CFG.rainDurationMs;
    this.currentEvent = { kind, endsAt: this.time.now + duration, overlay };
    this.time.delayedCall(duration, () => this.endEvent());
  }

  private endEvent(): void {
    if (!this.currentEvent) return;
    const { overlay } = this.currentEvent;
    this.currentEvent = null;
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 350,
      onComplete: () => overlay.destroy(),
    });
    this.scheduleNextEvent();
  }

  // ----- Rendering -----

  private redrawMeter(bandLow: number, bandHigh: number, bandCenter: number): void {
    const { width, height } = this.scale;
    const x = width - 60;
    const y = height / 2 - CFG.meterBarHeight / 2;
    const w = CFG.meterBarWidth;
    const h = CFG.meterBarHeight;

    const g = this.meterGfx;
    g.clear();

    // Frame
    g.fillStyle(0x1a1a1a, 0.55);
    g.fillRoundedRect(x - 4, y - 4, w + 8, h + 8, 8);
    g.fillStyle(0x3a2818, 1);
    g.fillRoundedRect(x, y, w, h, 4);

    // Green band overlay (visualizes "happy zone")
    const bandTopY = y + h * (1 - bandHigh / CFG.meterMax);
    const bandBotY = y + h * (1 - bandLow / CFG.meterMax);
    g.fillStyle(0x2f6a2c, 0.85);
    g.fillRect(x, bandTopY, w, bandBotY - bandTopY);

    // Center sub-band marker (faint highlight stripe)
    const centerTopY = y + h * (1 - (bandCenter + CFG.centerBandHalfWidth) / CFG.meterMax);
    const centerBotY = y + h * (1 - (bandCenter - CFG.centerBandHalfWidth) / CFG.meterMax);
    g.fillStyle(0x9efc9b, 0.55);
    g.fillRect(x, centerTopY, w, centerBotY - centerTopY);

    // Current fill (color shifts dramatic if outside band)
    const fillTop = y + h * (1 - this.displayedMeter / CFG.meterMax);
    const meterColor =
      this.displayedMeter < bandLow ? 0xd24a3a
      : this.displayedMeter > bandHigh ? 0x4aa9d2
      : 0xf7c948;
    g.fillStyle(meterColor, 1);
    g.fillRect(x + 2, fillTop, w - 4, y + h - fillTop);

    // Tick marks at 25/50/75
    g.lineStyle(1, 0xfff5b7, 0.35);
    for (const pct of [0.25, 0.5, 0.75]) {
      const ty = y + h * (1 - pct);
      g.lineBetween(x, ty, x + w, ty);
    }
  }

  private redrawStream(watering: boolean, spoutX: number, spoutY: number): void {
    const g = this.streamGfx;
    g.clear();
    if (!watering) return;
    // A few falling droplets from spout to cactus top.
    const dy = this.cactus.y - spoutY;
    const steps = 5;
    g.fillStyle(0x7fbcef, 0.85);
    for (let i = 0; i < steps; i++) {
      const t = (i + Phaser.Math.FloatBetween(0, 1)) / steps;
      const x = spoutX + (this.cactus.x - spoutX) * t + Phaser.Math.Between(-3, 3);
      const y = spoutY + dy * t;
      g.fillCircle(x, y, 3.5);
    }
  }

  /**
   * Threshold reached — next level unlocked, but the player keeps tending the
   * cactus until the timer ends. Mirrors L1/L2/L3.
   */
  private markUnlocked(): void {
    this.passed = true;
    sfx.unlock();
    this.happyText.setColor('#9efc9b');

    const { width, height } = this.scale;
    this.unlockBanner = this.add.text(width / 2, height / 2, 'Level Unlocked!\nKeep watering for bonus', {
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

  private endRun(reason: 'survived' | 'wilted' | 'drowned'): void {
    if (this.finished) return;
    this.finished = true;
    this.cancelTimers();

    if (this.unlockBanner) {
      this.unlockBanner.destroy();
      this.unlockBanner = null;
    }

    if (reason !== 'survived' && !this.passed) sfx.pop();

    const elapsedMs = Math.min(CFG.surviveMs, this.time.now - this.startedAt);
    const happySec = Math.floor(this.happyTimeMs / 1000);
    const { width, height } = this.scale;

    let text: string;
    let color: string;
    let stroke: string;
    if (this.passed) {
      text = `Cleared!\nHappy time: ${happySec}s`;
      color = '#9efc9b';
      stroke = '#1f5a2d';
    } else if (reason === 'wilted') {
      text = `Your cactus wilted.\nHappy: ${happySec}s`;
      color = '#d24a3a';
      stroke = '#5a2d1f';
    } else if (reason === 'drowned') {
      text = `Drowned!\nHappy: ${happySec}s`;
      color = '#4aa9d2';
      stroke = '#243a5a';
    } else {
      text = `Keep trying.\nHappy: ${happySec}s / ${CFG.passThreshold}s`;
      color = '#f7c948';
      stroke = '#5a2d1f';
    }

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
        miniGamePoints: happySec,
        elapsedMs,
        bonusPoints: this.bonusPoints,
      });
    });
  }

  private cancelTimers(): void {
    this.nextEventTimer?.remove();
    this.nextEventTimer = undefined;
    if (this.currentEvent) {
      this.currentEvent.overlay.destroy();
      this.currentEvent = null;
    }
  }
}
