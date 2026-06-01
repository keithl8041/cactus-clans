import Phaser from 'phaser';
import { loadAsset } from '../../assets/loader';
import { resolvePetCactusKey } from '../../assets/manifest';
import { sfx } from '../../assets/sfx';
import type { LevelContext } from '../types';
import { CACTUS_CARE_CONFIG as CFG } from './config';

type EventKind = 'sun' | 'rain';

interface ActiveEvent {
  kind: EventKind;
  endsAt: number;
}

// The thirst-gauge.png is a wooden frame with droplet at top and sun at bottom.
// These ratios describe the empty interior column where the meter fill is drawn,
// expressed as fractions of the full sprite (200x900 native).
const GAUGE_INTERIOR = {
  topPct: 0.138,
  bottomPct: 0.795,
  leftPct: 0.36,
  rightPct: 0.64,
} as const;

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

  // Wilt/drown countdowns
  private wiltCountdownStartAt: number | null = null;
  private drownCountdownStartAt: number | null = null;

  // Events
  private currentEvent: ActiveEvent | null = null;
  private nextEventTimer?: Phaser.Time.TimerEvent;
  private lastWaterChirpAt = 0;

  // Background (swapped on sun/rain events)
  private background!: Phaser.GameObjects.Image;
  private bgScale = 1;
  private currentBgKey = 'game4.background';

  private cactusHappyKey = 'cactus.pet';

  // Gauge (decorative frame for the meter)
  private gauge!: Phaser.GameObjects.Image;
  private readonly barRect = new Phaser.Geom.Rectangle();
  private readonly barCornerRadius = 12;

  // Graphics
  private meterGfx!: Phaser.GameObjects.Graphics;
  private streamGfx!: Phaser.GameObjects.Graphics;
  private dropletGfx!: Phaser.GameObjects.Container;

  // HUD
  private happyText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private bonusText!: Phaser.GameObjects.Text;
  private unlockBanner: Phaser.GameObjects.Text | null = null;

  // Keyboard (desktop) — Space pours. No aiming, so no cursor handling.
  private keySpace!: Phaser.Input.Keyboard.Key;

  constructor(ctx: LevelContext) {
    super({ key: 'CactusCareScene' });
    this.ctx = ctx;
  }

  preload(): void {
    this.cactusHappyKey = resolvePetCactusKey(this.ctx.clan.name, 'happy');
    const cactusOpts = { size: CFG.cactusSize, clanColor: this.ctx.clan.color };
    loadAsset(this, this.cactusHappyKey, this.cactusHappyKey, cactusOpts);

    loadAsset(this, 'wateringCan', 'game4.watering-can');
    loadAsset(this, 'waterDroplet', 'game4.water-droplet');
    loadAsset(this, 'thirstGauge', 'game4.thirst-gauge');
    loadAsset(this, 'game4.background', 'game4.background');
    loadAsset(this, 'game4.background.sun', 'game4.background.sun');
    loadAsset(this, 'game4.background.rain', 'game4.background.rain');
    loadAsset(this, 'cactus.spike', 'cactus.spike');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, CFG.backgroundColor).setOrigin(0);
    this.background = this.add.image(width / 2, height / 2, 'game4.background').setDepth(0);
    this.bgScale = Math.max(width / this.background.width, height / this.background.height);
    this.background.setScale(this.bgScale);

    this.setupScene();
    this.setupHud();
    this.setupInput();

    this.streamGfx = this.add.graphics().setDepth(6);
    this.dropletGfx = this.add.container(0, 0).setDepth(6);
    this.meterGfx = this.add.graphics().setDepth(11);

    // Clip the meter fill to a rounded rect so the wooden chrome edges read clean.
    const maskGfx = this.make.graphics({}, false);
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRoundedRect(
      this.barRect.x,
      this.barRect.y,
      this.barRect.width,
      this.barRect.height,
      this.barCornerRadius,
    );
    this.meterGfx.setMask(maskGfx.createGeometryMask());

    this.startedAt = this.time.now;
    this.scheduleNextEvent(CFG.firstEventDelayMs);
  }

  update(time: number, delta: number): void {
    if (this.finished) return;
    const dtSec = delta / 1000;
    const elapsed = time - this.startedAt;

    // The can is fixed above the cactus — there's no aiming. Whether we're
    // pouring is simply whether a tap/hold (or Space) is currently active.
    const watering = this.resolveInput();

    // Tilt the can toward the cactus while pouring; settle to a gentle idle lean.
    const targetTilt = watering ? CFG.canWateringTiltRad : CFG.canRestTiltRad;
    this.can.rotation += (targetTilt - this.can.rotation) * CFG.canTiltSmoothing;

    // Spout position used for the rendered stream tracks the current rotation.
    const cos = Math.cos(this.can.rotation);
    const sin = Math.sin(this.can.rotation);
    const spoutX = this.can.x + cos * CFG.canSpoutOffsetX - sin * CFG.canSpoutOffsetY;
    const spoutY = this.can.y + sin * CFG.canSpoutOffsetX + cos * CFG.canSpoutOffsetY;

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

    // Pet cactus — large, friendly. PNG art includes the pot.
    const cactusX = width * 0.5;
    const cactusY = height * 0.62;
    this.cactus = this.add.image(cactusX, cactusY, this.cactusHappyKey).setDepth(3);
    // PNG art is square; size by setting display height so layout matches CFG.cactusSize.
    const cactusDisplay = CFG.cactusSize * 1.8;
    this.cactus.setDisplaySize(cactusDisplay, cactusDisplay);

    // Decorative thirst gauge frame on the right; the meter renders inside it.
    const gaugeRight = width - 38;
    const gaugeCenterY = height / 2 + 10;
    this.gauge = this.add.image(gaugeRight, gaugeCenterY, 'thirstGauge')
      .setOrigin(1, 0.5)
      .setDepth(10);
    const gaugeDisplayHeight = CFG.meterBarHeight / (GAUGE_INTERIOR.bottomPct - GAUGE_INTERIOR.topPct);
    const gaugeScale = gaugeDisplayHeight / this.gauge.height;
    this.gauge.setScale(gaugeScale);

    // Precompute the fill bar rect inside the wooden interior column.
    const gW = this.gauge.displayWidth;
    const gH = this.gauge.displayHeight;
    const gLeft = this.gauge.x - gW; // origin (1, 0.5)
    const gTop = this.gauge.y - gH / 2;
    const barX = gLeft + gW * GAUGE_INTERIOR.leftPct + 2;
    const barW = gW * (GAUGE_INTERIOR.rightPct - GAUGE_INTERIOR.leftPct);
    const barY = gTop + gH * GAUGE_INTERIOR.topPct + 15;
    const barH = gH * (GAUGE_INTERIOR.bottomPct - GAUGE_INTERIOR.topPct) - 15;
    this.barRect.setTo(barX, barY, barW, barH);

    // Watering can sits about halfway between its old up-and-left rest spot and
    // the top of the cactus, so the pour reads as landing right on the plant.
    const oldRestX = cactusX - CFG.cactusSize * 0.9;
    const oldRestY = height * 0.25;
    const cactusTopY = cactusY - cactusDisplay / 2;
    this.canRestPos.set((oldRestX + cactusX) / 2, (oldRestY + cactusTopY) / 2);
    this.can = this.add.image(this.canRestPos.x, this.canRestPos.y, 'wateringCan').setDepth(5);
    this.can.setDisplaySize(CFG.canSize * 1.4, CFG.canSize * 1.4);
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
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);

    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  // ----- Input handlers -----

  private handlePointerDown(p: Phaser.Input.Pointer): void {
    if (this.finished) return;
    if (this.activePointerId != null) return; // already tracking a pointer
    this.activePointerId = p.id;
    this.pointerActive = true;
  }

  private handlePointerUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.activePointerId) return;
    this.activePointerId = null;
    this.pointerActive = false;
  }

  /**
   * True while a pour input is active. The can is fixed in place, so position
   * is irrelevant — a tap/hold anywhere (or holding Space) pours.
   */
  private resolveInput(): boolean {
    return this.pointerActive || this.keySpace.isDown;
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
    this.swapBackground(kind === 'sun' ? 'game4.background.sun' : 'game4.background.rain');

    const duration = kind === 'sun' ? CFG.sunBlastDurationMs : CFG.rainDurationMs;
    this.currentEvent = { kind, endsAt: this.time.now + duration };
    this.time.delayedCall(duration, () => this.endEvent());
  }

  private endEvent(): void {
    if (!this.currentEvent) return;
    this.currentEvent = null;
    this.swapBackground('game4.background');
    this.scheduleNextEvent();
  }

  private swapBackground(key: string): void {
    if (this.currentBgKey === key) return;
    this.currentBgKey = key;
    this.background.setTexture(key);
    this.background.setScale(this.bgScale);
  }

  // ----- Rendering -----

  private redrawMeter(bandLow: number, bandHigh: number, bandCenter: number): void {
    const { x, y, width: w, height: h } = this.barRect;

    const gfx = this.meterGfx;
    gfx.clear();

    // Green band overlay (visualizes "happy zone").
    const bandTopY = y + h * (1 - bandHigh / CFG.meterMax);
    const bandBotY = y + h * (1 - bandLow / CFG.meterMax);
    gfx.fillStyle(0x2f6a2c, 0.75);
    gfx.fillRect(x, bandTopY, w, bandBotY - bandTopY);

    // Center sub-band marker.
    const centerTopY = y + h * (1 - (bandCenter + CFG.centerBandHalfWidth) / CFG.meterMax);
    const centerBotY = y + h * (1 - (bandCenter - CFG.centerBandHalfWidth) / CFG.meterMax);
    gfx.fillStyle(0x9efc9b, 0.55);
    gfx.fillRect(x, centerTopY, w, centerBotY - centerTopY);

    // Current fill — water rises from the bottom (sun) to the top (droplet).
    const fillTop = y + h * (1 - this.displayedMeter / CFG.meterMax);
    const meterColor =
      this.displayedMeter < bandLow ? 0xd24a3a
      : this.displayedMeter > bandHigh ? 0x4aa9d2
      : 0x6ec0ef;
    gfx.fillStyle(meterColor, 1);
    gfx.fillRect(x, fillTop, w, y + h - fillTop);
  }

  private redrawStream(watering: boolean, spoutX: number, spoutY: number): void {
    this.streamGfx.clear();
    this.dropletGfx.removeAll(true);
    if (!watering) return;
    // A handful of droplet sprites falling from spout to cactus.
    const dy = this.cactus.y - spoutY;
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const t = (i + Phaser.Math.FloatBetween(0, 1)) / steps;
      const x = spoutX + (this.cactus.x - spoutX) * t + Phaser.Math.Between(-4, 4);
      const y = spoutY + dy * t;
      const droplet = this.add.image(x, y, 'waterDroplet');
      droplet.setDisplaySize(14, 18);
      droplet.setAlpha(0.9);
      this.dropletGfx.add(droplet);
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
      this.currentEvent = null;
      this.swapBackground('game4.background');
    }
  }
}
