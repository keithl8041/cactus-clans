import Phaser from 'phaser';
import { loadAsset } from '../../assets/loader';
import { sfx } from '../../assets/sfx';
import type { LevelContext } from '../types';
import { LIZARD_WHACK_CONFIG as CFG } from './config';

type PotState = 'idle' | 'rising' | 'up' | 'falling' | 'cooldown';

interface PotSlot {
  index: number;
  x: number;
  y: number;
  tapRect: Phaser.Geom.Rectangle;
  pot: Phaser.GameObjects.Image;
  lizard: Phaser.GameObjects.Image;
  state: PotState;
  isBandit: boolean;
  upStartedAt: number;
  windowAtSpawn: number;
  retractTimer?: Phaser.Time.TimerEvent;
  cooldownTimer?: Phaser.Time.TimerEvent;
  riseTween?: Phaser.Tweens.Tween;
  fallTween?: Phaser.Tweens.Tween;
}

export class LizardWhackScene extends Phaser.Scene {
  private readonly ctx: LevelContext;

  private pots: PotSlot[] = [];
  private score = 0;
  private bonusPoints = 0;
  private misses = 0;
  private passed = false;
  private finished = false;
  private startedAt = 0;
  private endsAt = 0;

  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private missText!: Phaser.GameObjects.Text;

  private spawnTimer?: Phaser.Time.TimerEvent;
  private unlockBanner: Phaser.GameObjects.Text | null = null;

  constructor(ctx: LevelContext) {
    super({ key: 'LizardWhackScene' });
    this.ctx = ctx;
  }

  preload(): void {
    loadAsset(this, 'game3.background', 'game3.background');
    loadAsset(this, 'pot', 'game3.pot');
    loadAsset(this, 'lizard.up', 'game3.lizard.green');
    loadAsset(this, 'lizard.down', 'game3.lizard.dark-green');
    loadAsset(this, 'lizard.bandit', 'game3.lizard.gold');
    loadAsset(this, 'hit.splat', 'game3.hit-splat');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, CFG.backgroundColor).setOrigin(0);
    const bg = this.add.image(width / 2, height / 2, 'game3.background').setDepth(0);
    const bgScale = Math.max(width / bg.width, height / bg.height);
    bg.setScale(bgScale);

    this.setupGrid();
    this.setupInput();
    this.setupHud();

    this.startedAt = this.time.now;
    this.endsAt = this.startedAt + CFG.roundDurationMs;
    this.scheduleNextSpawn();
  }

  update(time: number, _delta: number): void {
    if (this.finished) return;

    const remainMs = Math.max(0, this.endsAt - time);
    this.timeText.setText(`Time: ${(remainMs / 1000).toFixed(1)}s`);

    if (time >= this.endsAt) {
      this.finish();
    }
  }

  // ----- Setup helpers -----

  private setupGrid(): void {
    const { width, height } = this.scale;
    const padX = width * CFG.gridHorizontalPadding;
    const padY = height * CFG.gridVerticalPadding;
    const cellW = (width - padX * 2) / CFG.gridCols;
    const cellH = (height - padY * 2) / CFG.gridRows;
    const tapHalfW = cellW / 2 + CFG.tapPadding;
    const tapHalfH = cellH / 2 + CFG.tapPadding;

    let index = 0;
    for (let row = 0; row < CFG.gridRows; row++) {
      for (let col = 0; col < CFG.gridCols; col++) {
        const x = padX + cellW * (col + 0.5);
        const y = padY + cellH * (row + 0.5);

        const pot = this.add.image(x, y, 'pot').setDepth(2);
        pot.setScale(CFG.potSize / pot.height);

        // Lizard sits inside the pot — depth above the pot so it can rise out
        // of the top, hidden until popUp() sets it visible.
        const lizard = this.add.image(x, y, 'lizard.up').setDepth(3);
        lizard.setScale(CFG.lizardSize / lizard.height);
        lizard.setVisible(false);

        this.pots.push({
          index,
          x, y,
          tapRect: new Phaser.Geom.Rectangle(x - tapHalfW, y - tapHalfH, tapHalfW * 2, tapHalfH * 2),
          pot,
          lizard,
          state: 'idle',
          isBandit: false,
          upStartedAt: 0,
          windowAtSpawn: 0,
        });
        index++;
      }
    }
  }

  private setupInput(): void {
    // Allow up to four simultaneous pointers — kids will mash with both hands.
    this.input.addPointer(3);
    this.input.on('pointerdown', this.handleTap, this);

    const kb = this.input.keyboard;
    if (kb) {
      const keys: number[] = [
        Phaser.Input.Keyboard.KeyCodes.ONE,
        Phaser.Input.Keyboard.KeyCodes.TWO,
        Phaser.Input.Keyboard.KeyCodes.THREE,
        Phaser.Input.Keyboard.KeyCodes.FOUR,
        Phaser.Input.Keyboard.KeyCodes.FIVE,
        Phaser.Input.Keyboard.KeyCodes.SIX,
        Phaser.Input.Keyboard.KeyCodes.SEVEN,
        Phaser.Input.Keyboard.KeyCodes.EIGHT,
        Phaser.Input.Keyboard.KeyCodes.NINE,
      ];
      keys.forEach((code, i) => {
        kb.addKey(code).on('down', () => this.tapPotByIndex(i));
      });
    }
  }

  private setupHud(): void {
    const { width } = this.scale;
    this.scoreText = this.add.text(16, 16, `Score: 0 / ${CFG.passThreshold}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#f7c948',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(10);

    this.missText = this.add.text(16, 46, `Misses: 0 / ${CFG.missTolerance}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#fff5b7',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(10);

    this.timeText = this.add.text(width - 16, 16, 'Time: 30.0s', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#f3efe0',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);
  }

  // ----- Spawning -----

  private scheduleNextSpawn(): void {
    if (this.finished) return;
    const elapsedFrac = Math.min(1, (this.time.now - this.startedAt) / CFG.roundDurationMs);
    const baseInterval = Phaser.Math.Linear(CFG.spawnIntervalStartMs, CFG.spawnIntervalEndMs, elapsedFrac);
    const interval = Math.max(120, baseInterval + Phaser.Math.Between(-CFG.spawnJitterMs, CFG.spawnJitterMs));
    this.spawnTimer = this.time.delayedCall(interval, () => this.spawnTick());
  }

  private spawnTick(): void {
    if (this.finished) return;
    const idle = this.pots.filter((p) => p.state === 'idle');
    if (idle.length === 0) {
      this.scheduleNextSpawn();
      return;
    }
    const elapsed = this.time.now - this.startedAt;
    const allowDoubles = elapsed >= CFG.doublesStartAtMs;
    const popN = (allowDoubles && Math.random() < CFG.doublesProbability) ? 2 : 1;
    const count = Math.min(popN, idle.length);
    Phaser.Utils.Array.Shuffle(idle);
    for (let i = 0; i < count; i++) {
      const allowBandit = elapsed >= CFG.banditWarmupMs;
      const isBandit = allowBandit && Math.random() < CFG.banditProbability;
      this.popUp(idle[i], isBandit);
    }
    this.scheduleNextSpawn();
  }

  private currentWindowMs(): number {
    const frac = Math.min(1, (this.time.now - this.startedAt) / CFG.roundDurationMs);
    return Phaser.Math.Linear(CFG.windowMs, CFG.windowMinMs, frac);
  }

  private popUp(pot: PotSlot, isBandit: boolean): void {
    pot.state = 'rising';
    pot.isBandit = isBandit;
    const normalTexture = Math.random() < 0.5 ? 'lizard.up' : 'lizard.down';
    pot.lizard.setTexture(isBandit ? 'lizard.bandit' : normalTexture);
    pot.lizard.setScale((CFG.lizardSize / pot.lizard.height) * 0.2);
    pot.lizard.setAlpha(1);
    pot.lizard.setPosition(pot.x, pot.y + 20);
    pot.lizard.setVisible(true);

    const targetScale = CFG.lizardSize / pot.lizard.height;
    pot.riseTween = this.tweens.add({
      targets: pot.lizard,
      scaleX: targetScale,
      scaleY: targetScale,
      y: pot.y,
      duration: CFG.riseMs,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (pot.state !== 'rising') return;
        pot.state = 'up';
        pot.upStartedAt = this.time.now;
        pot.windowAtSpawn = this.currentWindowMs();
        pot.retractTimer = this.time.delayedCall(pot.windowAtSpawn, () => this.beginFall(pot, false));
      },
    });
  }

  private beginFall(pot: PotSlot, whacked: boolean): void {
    if (pot.state !== 'up' && pot.state !== 'rising') return;
    pot.state = 'falling';
    pot.retractTimer?.remove();
    pot.retractTimer = undefined;
    pot.riseTween?.stop();
    pot.riseTween = undefined;

    if (whacked) {
      // Snap-hide on whack — no fall tween, the splat covers the disappearance.
      pot.lizard.setVisible(false);
      pot.state = 'cooldown';
      pot.cooldownTimer = this.time.delayedCall(CFG.cooldownMs, () => {
        if (pot.state === 'cooldown') pot.state = 'idle';
      });
      return;
    }

    const startScale = pot.lizard.scaleX;
    pot.fallTween = this.tweens.add({
      targets: pot.lizard,
      scaleX: startScale * 0.2,
      scaleY: startScale * 0.2,
      y: pot.y + 20,
      alpha: 0,
      duration: CFG.fallMs,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        pot.lizard.setVisible(false);
        pot.lizard.setAlpha(1);
        this.misses += 1;
        this.updateMissText();
        pot.state = 'cooldown';
        pot.cooldownTimer = this.time.delayedCall(CFG.cooldownMs, () => {
          if (pot.state === 'cooldown') pot.state = 'idle';
        });
        if (this.misses >= CFG.missTolerance) this.finish();
      },
    });
  }

  // ----- Input -----

  private handleTap(pointer: Phaser.Input.Pointer): void {
    if (this.finished) return;
    for (const pot of this.pots) {
      if (Phaser.Geom.Rectangle.Contains(pot.tapRect, pointer.x, pointer.y)) {
        this.tryWhack(pot);
        return;
      }
    }
  }

  private tapPotByIndex(i: number): void {
    if (this.finished) return;
    const pot = this.pots[i];
    if (pot) this.tryWhack(pot);
  }

  private tryWhack(pot: PotSlot): void {
    if (pot.state !== 'rising' && pot.state !== 'up') return;

    const now = this.time.now;
    const wasFresh = pot.state === 'rising'
      || (now - pot.upStartedAt) <= pot.windowAtSpawn * CFG.freshFraction;

    let points: number;
    if (pot.isBandit) {
      points = CFG.pointsBandit;
      this.bonusPoints += CFG.banditBonusPoints;
      sfx.bullseye();
    } else if (wasFresh) {
      points = CFG.pointsFresh;
      sfx.hit();
    } else {
      points = CFG.pointsLate;
      sfx.thunk();
    }

    this.score += points;
    this.updateScoreText();
    this.spawnSplat(pot.x, pot.y);
    this.spawnFloatingText(pot.x, pot.y, `+${points}`);

    this.beginFall(pot, true);

    if (!this.passed && this.score >= CFG.passThreshold) {
      this.markUnlocked();
    }
  }

  // ----- HUD updates -----

  private updateScoreText(): void {
    if (this.passed) {
      this.scoreText.setText(`Score: ${this.score} ✓`);
    } else {
      this.scoreText.setText(`Score: ${this.score} / ${CFG.passThreshold}`);
    }
  }

  private updateMissText(): void {
    this.missText.setText(`Misses: ${this.misses} / ${CFG.missTolerance}`);
    if (this.misses >= CFG.missTolerance - 2) {
      this.missText.setColor('#d24a3a');
    }
  }

  // ----- FX -----

  private spawnSplat(x: number, y: number): void {
    const splat = this.add.image(x, y, 'hit.splat').setDepth(8);
    splat.setScale((CFG.lizardSize / splat.height) * 0.6);
    const finalScale = (CFG.lizardSize / splat.height) * 1.4;
    this.tweens.add({
      targets: splat,
      scaleX: finalScale,
      scaleY: finalScale,
      alpha: 0,
      duration: CFG.hitSplatDurationMs,
      ease: 'Sine.easeOut',
      onComplete: () => splat.destroy(),
    });
  }

  private spawnFloatingText(x: number, y: number, text: string): void {
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
      y: y - CFG.bonusFloatRiseY,
      alpha: 0,
      duration: CFG.floatTextDurationMs,
      ease: 'Sine.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /**
   * Threshold reached — next level unlocked, but the player keeps whacking
   * for bonus points until the timer ends. Mirrors L1/L2's "keep going" pattern.
   */
  private markUnlocked(): void {
    this.passed = true;
    sfx.unlock();
    this.scoreText.setColor('#9efc9b');
    this.updateScoreText();

    const { width, height } = this.scale;
    this.unlockBanner = this.add.text(width / 2, height / 2, 'Level Unlocked!\nKeep whacking for bonus', {
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

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.cancelTimers();

    // Banner overlap safety: clear any in-flight unlock banner before the finish banner.
    if (this.unlockBanner) {
      this.unlockBanner.destroy();
      this.unlockBanner = null;
    }

    if (!this.passed) sfx.pop();

    const elapsedMs = Math.min(CFG.roundDurationMs, this.time.now - this.startedAt);
    const { width, height } = this.scale;
    const text = this.passed
      ? `Cleared!\nFinal: ${this.score} pts`
      : `Time!\nScore: ${this.score}`;
    const color = this.passed ? '#9efc9b' : '#f7c948';
    const stroke = this.passed ? '#1f5a2d' : '#5a2d1f';

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
        bonusPoints: this.bonusPoints,
      });
    });
  }

  private cancelTimers(): void {
    this.spawnTimer?.remove();
    this.spawnTimer = undefined;
    for (const pot of this.pots) {
      pot.retractTimer?.remove();
      pot.cooldownTimer?.remove();
      pot.riseTween?.stop();
      pot.fallTween?.stop();
    }
  }
}
