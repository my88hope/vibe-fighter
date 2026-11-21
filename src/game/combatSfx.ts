import { getEffectiveVolume } from './core/audio';
import type { AttackKind, GameSettings } from './types';

let sharedContext: AudioContext | null = null;
const noiseBufferCache = new WeakMap<AudioContext, AudioBuffer>();

export interface AttackImpactSfxOptions {
  characterId?: string;
  finisher?: boolean;
}

/**
 * Safely returns the shared Web Audio context for combat sound synthesis, or
 * null in non-browser/headless environments where Web Audio is unavailable.
 */
export function getCombatAudioContext(): AudioContext | null {
  if (sharedContext) {
    return sharedContext;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!Ctor) {
    return null;
  }

  try {
    sharedContext = new Ctor();
    return sharedContext;
  } catch {
    return null;
  }
}

/**
 * Plays a fast, snappy air whoosh when throwing a light punch.
 */
export function playPunchSwingSfx(
  settings: GameSettings,
  audioCtx: AudioContext | null = getCombatAudioContext()
): void {
  const vol = getEffectiveVolume(0.32, 'sfx', settings);
  if (!audioCtx || vol <= 0) {
    return;
  }

  resumeIfSuspended(audioCtx);
  const now = audioCtx.currentTime;

  playNoiseBurst(audioCtx, now, {
    duration: 0.075,
    volume: vol * 0.8,
    filterType: 'bandpass',
    freqStart: 1550,
    freqEnd: 540,
    q: 2.2
  });

  playTone(audioCtx, now, {
    type: 'triangle',
    freqStart: 360,
    freqEnd: 135,
    duration: 0.055,
    volume: vol * 0.4
  });
}

/**
 * Plays a deeper, heavier sweep whoosh when throwing a kick / heavy strike.
 */
export function playKickSwingSfx(
  settings: GameSettings,
  audioCtx: AudioContext | null = getCombatAudioContext()
): void {
  const vol = getEffectiveVolume(0.38, 'sfx', settings);
  if (!audioCtx || vol <= 0) {
    return;
  }

  resumeIfSuspended(audioCtx);
  const now = audioCtx.currentTime;

  playNoiseBurst(audioCtx, now, {
    duration: 0.13,
    volume: vol * 0.85,
    filterType: 'bandpass',
    freqStart: 920,
    freqEnd: 230,
    q: 1.5
  });

  playTone(audioCtx, now, {
    type: 'triangle',
    freqStart: 220,
    freqEnd: 72,
    duration: 0.11,
    volume: vol * 0.55
  });
}

/**
 * Plays the impact SFX when a punch, kick, or special connects (clean or blocked).
 */
export function playAttackHitSfx(
  settings: GameSettings,
  kind: AttackKind,
  blocked: boolean,
  options: AttackImpactSfxOptions = {},
  audioCtx: AudioContext | null = getCombatAudioContext()
): void {
  const baseVolume = kind === 'special' ? 0.52 : kind === 'low' ? 0.48 : 0.42;
  const vol = getEffectiveVolume(baseVolume, 'sfx', settings);
  if (!audioCtx || vol <= 0) {
    return;
  }

  resumeIfSuspended(audioCtx);
  const now = audioCtx.currentTime;

  if (blocked) {
    playBlockedHit(audioCtx, now, kind, vol);
    return;
  }

  if (kind === 'high') {
    // Crisp punch impact: snappy slap + tight chest thump
    playTone(audioCtx, now, {
      type: 'sine',
      freqStart: 185,
      freqEnd: 52,
      duration: 0.09,
      volume: vol * 0.95
    });
    playNoiseBurst(audioCtx, now, {
      duration: 0.065,
      volume: vol * 0.72,
      filterType: 'bandpass',
      freqStart: 1950,
      freqEnd: 780,
      q: 1.1
    });
    return;
  }

  if (kind === 'low') {
    // Heavy kick impact: deep sub thud + mid crunch + heavy crack
    playTone(audioCtx, now, {
      type: 'sine',
      freqStart: 145,
      freqEnd: 36,
      duration: 0.15,
      volume: vol * 1.05
    });
    playTone(audioCtx, now, {
      type: 'sawtooth',
      freqStart: 260,
      freqEnd: 64,
      duration: 0.09,
      volume: vol * 0.42,
      lowpassHz: 920
    });
    playNoiseBurst(audioCtx, now, {
      duration: 0.105,
      volume: vol * 0.78,
      filterType: 'bandpass',
      freqStart: 1350,
      freqEnd: 380,
      q: 1.0
    });
    return;
  }

  playSpecialImpact(audioCtx, now, vol, options);
}

/**
 * Plays the dramatic super-flash & power-charge SFX as the cut-in triggers.
 */
export function playSpecialChargeSfx(
  settings: GameSettings,
  characterId = '',
  audioCtx: AudioContext | null = getCombatAudioContext()
): void {
  const vol = getEffectiveVolume(0.42, 'sfx', settings);
  if (!audioCtx || vol <= 0) {
    return;
  }

  resumeIfSuspended(audioCtx);
  const now = audioCtx.currentTime;

  // Super-flash metallic/harmonic sting
  const rootFreq = characterId === 'gojo' ? 520 : characterId === 'ichigo' ? 440 : 660;
  playTone(audioCtx, now, {
    type: 'triangle',
    freqStart: rootFreq,
    freqEnd: rootFreq * 1.5,
    duration: 0.22,
    volume: vol * 0.55
  });
  playTone(audioCtx, now + 0.04, {
    type: 'sine',
    freqStart: rootFreq * 1.5,
    freqEnd: rootFreq * 2.0,
    duration: 0.24,
    volume: vol * 0.42
  });

  // Rising energy charge sweep
  playTone(audioCtx, now, {
    type: 'sawtooth',
    freqStart: 150,
    freqEnd: 540,
    duration: 0.38,
    volume: vol * 0.36,
    lowpassHz: 1800
  });
  playNoiseBurst(audioCtx, now, {
    duration: 0.36,
    volume: vol * 0.34,
    filterType: 'bandpass',
    freqStart: 420,
    freqEnd: 1700,
    q: 1.6
  });
}

/**
 * Plays the character-specific special move launch SFX when the move fires.
 */
export function playSpecialExecuteSfx(
  settings: GameSettings,
  characterId: string,
  audioCtx: AudioContext | null = getCombatAudioContext()
): void {
  const vol = getEffectiveVolume(0.48, 'sfx', settings);
  if (!audioCtx || vol <= 0) {
    return;
  }

  resumeIfSuspended(audioCtx);
  const now = audioCtx.currentTime;

  switch (characterId) {
    case 'maki':
      // Split Soul Katana: razor metallic draw + fast air cleave
      playTone(audioCtx, now, {
        type: 'sine',
        freqStart: 1950,
        freqEnd: 820,
        duration: 0.19,
        volume: vol * 0.52
      });
      playTone(audioCtx, now + 0.02, {
        type: 'triangle',
        freqStart: 2780,
        freqEnd: 1240,
        duration: 0.16,
        volume: vol * 0.32
      });
      playNoiseBurst(audioCtx, now, {
        duration: 0.18,
        volume: vol * 0.8,
        filterType: 'highpass',
        freqStart: 2200,
        freqEnd: 650,
        q: 1.2
      });
      break;

    case 'gojo':
      // Hollow Purple: deep void convergence hum + resonant pulse blast
      playTone(audioCtx, now, {
        type: 'sine',
        freqStart: 105,
        freqEnd: 42,
        duration: 0.36,
        volume: vol * 0.95
      });
      playTone(audioCtx, now + 0.08, {
        type: 'sawtooth',
        freqStart: 320,
        freqEnd: 145,
        duration: 0.28,
        volume: vol * 0.45,
        lowpassHz: 1100
      });
      playTone(audioCtx, now + 0.09, {
        type: 'sine',
        freqStart: 482,
        freqEnd: 215,
        duration: 0.26,
        volume: vol * 0.34
      });
      playNoiseBurst(audioCtx, now + 0.09, {
        duration: 0.24,
        volume: vol * 0.58,
        filterType: 'bandpass',
        freqStart: 950,
        freqEnd: 260,
        q: 1.4
      });
      break;

    case 'naruto':
      // Rasengan: high-speed swirling chakra wind turbine
      playTone(audioCtx, now, {
        type: 'triangle',
        freqStart: 310,
        freqEnd: 790,
        duration: 0.26,
        volume: vol * 0.55
      });
      playNoiseBurst(audioCtx, now, {
        duration: 0.28,
        volume: vol * 0.85,
        filterType: 'bandpass',
        freqStart: 620,
        freqEnd: 2400,
        q: 2.2
      });
      break;

    case 'goku':
      // Kamehameha: blazing surging energy beam roar
      playTone(audioCtx, now, {
        type: 'sawtooth',
        freqStart: 195,
        freqEnd: 295,
        duration: 0.28,
        volume: vol * 0.55,
        lowpassHz: 1900
      });
      playTone(audioCtx, now + 0.06, {
        type: 'sine',
        freqStart: 140,
        freqEnd: 56,
        duration: 0.28,
        volume: vol * 0.78
      });
      playNoiseBurst(audioCtx, now, {
        duration: 0.32,
        volume: vol * 0.88,
        filterType: 'bandpass',
        freqStart: 1650,
        freqEnd: 520,
        q: 0.9
      });
      break;

    case 'luffy':
      // Red Hawk: fiery jet ignition + punch crackle
      playTone(audioCtx, now, {
        type: 'sawtooth',
        freqStart: 250,
        freqEnd: 72,
        duration: 0.22,
        volume: vol * 0.62,
        lowpassHz: 1100
      });
      playNoiseBurst(audioCtx, now, {
        duration: 0.25,
        volume: vol * 0.9,
        filterType: 'bandpass',
        freqStart: 1300,
        freqEnd: 320,
        q: 1.0
      });
      break;

    case 'tanjiro':
      // Water Breathing: rushing tidal wave sweep + katana ring
      playNoiseBurst(audioCtx, now, {
        duration: 0.28,
        volume: vol * 0.88,
        filterType: 'bandpass',
        freqStart: 540,
        freqEnd: 1650,
        q: 1.7
      });
      playTone(audioCtx, now + 0.03, {
        type: 'sine',
        freqStart: 1520,
        freqEnd: 760,
        duration: 0.18,
        volume: vol * 0.42
      });
      break;

    case 'ichigo':
      // Getsuga Tensho: dark crescent wave cleave + heavy blade roar
      playTone(audioCtx, now, {
        type: 'sawtooth',
        freqStart: 145,
        freqEnd: 58,
        duration: 0.28,
        volume: vol * 0.68,
        lowpassHz: 980
      });
      playTone(audioCtx, now, {
        type: 'sine',
        freqStart: 1320,
        freqEnd: 460,
        duration: 0.22,
        volume: vol * 0.42
      });
      playNoiseBurst(audioCtx, now, {
        duration: 0.26,
        volume: vol * 0.82,
        filterType: 'bandpass',
        freqStart: 1750,
        freqEnd: 340,
        q: 1.2
      });
      break;

    default:
      // Combo rush / energy burst for brawlers & custom fighters
      playTone(audioCtx, now, {
        type: 'sawtooth',
        freqStart: 210,
        freqEnd: 78,
        duration: 0.22,
        volume: vol * 0.56,
        lowpassHz: 1350
      });
      playNoiseBurst(audioCtx, now, {
        duration: 0.22,
        volume: vol * 0.82,
        filterType: 'bandpass',
        freqStart: 1450,
        freqEnd: 400,
        q: 1.3
      });
      break;
  }
}

function playBlockedHit(
  audioCtx: AudioContext,
  now: number,
  kind: AttackKind,
  vol: number
): void {
  if (kind === 'high') {
    playTone(audioCtx, now, {
      type: 'triangle',
      freqStart: 380,
      freqEnd: 140,
      duration: 0.06,
      volume: vol * 0.6
    });
    playNoiseBurst(audioCtx, now, {
      duration: 0.045,
      volume: vol * 0.42,
      filterType: 'bandpass',
      freqStart: 1150,
      freqEnd: 650,
      q: 2.0
    });
    return;
  }

  if (kind === 'low') {
    playTone(audioCtx, now, {
      type: 'triangle',
      freqStart: 230,
      freqEnd: 88,
      duration: 0.09,
      volume: vol * 0.72
    });
    playNoiseBurst(audioCtx, now, {
      duration: 0.065,
      volume: vol * 0.48,
      filterType: 'lowpass',
      freqStart: 780,
      freqEnd: 280,
      q: 1.1
    });
    return;
  }

  // Blocked special: metallic energy shield clang
  playTone(audioCtx, now, {
    type: 'triangle',
    freqStart: 540,
    freqEnd: 240,
    duration: 0.13,
    volume: vol * 0.62
  });
  playTone(audioCtx, now, {
    type: 'sine',
    freqStart: 810,
    freqEnd: 420,
    duration: 0.12,
    volume: vol * 0.44
  });
  playNoiseBurst(audioCtx, now, {
    duration: 0.09,
    volume: vol * 0.5,
    filterType: 'bandpass',
    freqStart: 1600,
    freqEnd: 520,
    q: 1.5
  });
}

function playSpecialImpact(
  audioCtx: AudioContext,
  now: number,
  vol: number,
  options: AttackImpactSfxOptions
): void {
  const scale = options.finisher ? 1.18 : 0.95;
  const duration = options.finisher ? 0.25 : 0.19;

  // Deep sub-boom common to all special impacts
  playTone(audioCtx, now, {
    type: 'sine',
    freqStart: 130,
    freqEnd: 30,
    duration,
    volume: Math.min(1, vol * scale)
  });

  playNoiseBurst(audioCtx, now, {
    duration: duration * 0.85,
    volume: vol * 0.85,
    filterType: 'lowpass',
    freqStart: 2400,
    freqEnd: 340,
    q: 0.9
  });

  switch (options.characterId) {
    case 'maki':
    case 'tanjiro':
    case 'ichigo':
      // Crisp katana slice ring on contact
      playTone(audioCtx, now, {
        type: 'sine',
        freqStart: 1620,
        freqEnd: 940,
        duration: 0.15,
        volume: vol * 0.48
      });
      playTone(audioCtx, now, {
        type: 'triangle',
        freqStart: 2380,
        freqEnd: 1480,
        duration: 0.12,
        volume: vol * 0.3
      });
      break;

    case 'gojo':
      // Void implosion harmonic
      playTone(audioCtx, now, {
        type: 'sawtooth',
        freqStart: 420,
        freqEnd: 90,
        duration: 0.22,
        volume: vol * 0.44,
        lowpassHz: 1400
      });
      break;

    case 'naruto':
      // Spiraling chakra grind burst
      playNoiseBurst(audioCtx, now, {
        duration: 0.18,
        volume: vol * 0.72,
        filterType: 'bandpass',
        freqStart: 700,
        freqEnd: 1950,
        q: 2.0
      });
      break;

    case 'goku':
    case 'luffy':
      // Explosive energy/fire crackle
      playTone(audioCtx, now, {
        type: 'sawtooth',
        freqStart: 300,
        freqEnd: 65,
        duration: 0.18,
        volume: vol * 0.48,
        lowpassHz: 1550
      });
      break;

    default:
      // Heavy super punch/kick double-crunch
      playTone(audioCtx, now + 0.025, {
        type: 'triangle',
        freqStart: 240,
        freqEnd: 58,
        duration: 0.14,
        volume: vol * 0.55
      });
      break;
  }
}

interface ToneOptions {
  type: OscillatorType;
  freqStart: number;
  freqEnd: number;
  duration: number;
  volume: number;
  lowpassHz?: number;
}

function playTone(audioCtx: AudioContext, startTime: number, opts: ToneOptions): void {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const peak = Math.max(0.0002, Math.min(0.95, opts.volume));

  osc.type = opts.type;
  osc.frequency.setValueAtTime(Math.max(20, opts.freqStart), startTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), startTime + opts.duration);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + opts.duration);

  if (opts.lowpassHz) {
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(opts.lowpassHz, startTime);
    osc.connect(filter);
    filter.connect(gain);
  } else {
    osc.connect(gain);
  }

  gain.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + opts.duration + 0.02);
}

interface NoiseOptions {
  duration: number;
  volume: number;
  filterType: BiquadFilterType;
  freqStart: number;
  freqEnd: number;
  q: number;
}

function playNoiseBurst(audioCtx: AudioContext, startTime: number, opts: NoiseOptions): void {
  const buffer = getNoiseBuffer(audioCtx);
  const source = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  const peak = Math.max(0.0002, Math.min(0.95, opts.volume));

  source.buffer = buffer;

  filter.type = opts.filterType;
  filter.Q.setValueAtTime(opts.q, startTime);
  filter.frequency.setValueAtTime(Math.max(40, opts.freqStart), startTime);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), startTime + opts.duration);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + opts.duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  source.start(startTime);
  source.stop(startTime + opts.duration + 0.02);
}

function getNoiseBuffer(audioCtx: AudioContext): AudioBuffer {
  const cached = noiseBufferCache.get(audioCtx);
  if (cached) {
    return cached;
  }

  const sampleRate = audioCtx.sampleRate || 44100;
  const length = Math.max(1, Math.round(sampleRate * 0.6));
  const buffer = audioCtx.createBuffer(1, length, sampleRate);
  const channel = buffer.getChannelData(0);

  for (let i = 0; i < length; i += 1) {
    channel[i] = Math.random() * 2 - 1;
  }

  noiseBufferCache.set(audioCtx, buffer);
  return buffer;
}

function resumeIfSuspended(audioCtx: AudioContext): void {
  if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
    void audioCtx.resume().catch(() => undefined);
  }
}
