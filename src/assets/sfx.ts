// Procedural sound effects via Web Audio. No audio files to ship — each call
// builds a short oscillator envelope at play time. Matches the placeholder
// pattern used by the sprite manifest: the game is fully playable without
// any audio assets in /public, and individual effects can be replaced with
// sampled clips later by swapping the relevant function.
//
// Browsers gate AudioContext on a user gesture. We lazily create the context
// on first play and resume it if it was created in a suspended state — by the
// time a level fires any of these, the player has already tapped through the
// shell, so the resume will succeed.
//
// Volumes are intentionally modest (kids' game, often played on a phone with
// a speaker held close).

let audioCtx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    // Returns a promise; we don't await — start() will still schedule
    // correctly once the context resumes.
    void audioCtx.resume();
  }
  return audioCtx;
}

interface ToneOptions {
  freq: number;
  endFreq?: number;
  durationMs: number;
  type?: OscillatorType;
  volume?: number;
  delayMs?: number;
}

function tone(opts: ToneOptions): void {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + (opts.delayMs ?? 0) / 1000;
  const t1 = t0 + opts.durationMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.endFreq != null) {
    // exponentialRamp can't hit 0 — endFreq must be > 0, which it always is here.
    osc.frequency.exponentialRampToValueAtTime(opts.endFreq, t1);
  }
  const peak = opts.volume ?? 0.2;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t1);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t1 + 0.02);
}

export const sfx = {
  /** Player heads the balloon. Short upward chirp. */
  hit(): void {
    tone({ freq: 660, endFreq: 880, durationMs: 80, type: 'triangle', volume: 0.18 });
  },
  /** Player jumps off the ground. Soft low thump. */
  jump(): void {
    tone({ freq: 320, endFreq: 520, durationMs: 110, type: 'square', volume: 0.08 });
  },
  /** Bonus star collected. Two-note arpeggio. */
  star(): void {
    tone({ freq: 880, endFreq: 1320, durationMs: 90, type: 'triangle', volume: 0.18 });
    tone({ freq: 1320, endFreq: 1760, durationMs: 120, type: 'triangle', volume: 0.16, delayMs: 80 });
  },
  /** Balloon pops (fail). Sharp downward pluck. */
  pop(): void {
    tone({ freq: 220, endFreq: 80, durationMs: 180, type: 'sawtooth', volume: 0.22 });
  },
  /** Level cleared. Major triad fanfare. */
  win(): void {
    tone({ freq: 523, durationMs: 120, type: 'triangle', volume: 0.20 }); // C5
    tone({ freq: 659, durationMs: 120, type: 'triangle', volume: 0.20, delayMs: 120 }); // E5
    tone({ freq: 784, durationMs: 240, type: 'triangle', volume: 0.22, delayMs: 240 }); // G5
  },
  setMuted(value: boolean): void {
    muted = value;
  },
  isMuted(): boolean {
    return muted;
  },
};
