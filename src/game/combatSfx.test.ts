import { describe, expect, it, vi } from 'vitest';

import {
  playAttackHitSfx,
  playKickSwingSfx,
  playPunchSwingSfx,
  playSpecialChargeSfx,
  playSpecialExecuteSfx
} from './combatSfx';
import type { GameSettings } from './types';

function createMockAudioContext(state: AudioContextState = 'running') {
  const oscillators: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  const bufferSources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  const resume = vi.fn().mockResolvedValue(undefined);

  const mockParam = () => ({
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn()
  });

  const ctx = {
    state,
    currentTime: 1.0,
    sampleRate: 44100,
    destination: {} as AudioDestinationNode,
    resume,
    createOscillator: vi.fn(() => {
      const node = {
        type: 'sine' as OscillatorType,
        frequency: mockParam(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      };
      oscillators.push(node);
      return node;
    }),
    createGain: vi.fn(() => ({
      gain: mockParam(),
      connect: vi.fn()
    })),
    createBiquadFilter: vi.fn(() => ({
      type: 'bandpass' as BiquadFilterType,
      Q: mockParam(),
      frequency: mockParam(),
      connect: vi.fn()
    })),
    createBuffer: vi.fn((_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length)
    })),
    createBufferSource: vi.fn(() => {
      const node = {
        buffer: null as AudioBuffer | null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      };
      bufferSources.push(node);
      return node;
    })
  } as unknown as AudioContext;

  return { ctx, oscillators, bufferSources, resume };
}

const activeSettings: GameSettings = {
  sfxVolume: 0.8,
  musicVolume: 0.5,
  muted: false
};

describe('combatSfx', () => {
  it('plays punch swing, kick swing, and hit impacts when unmuted', () => {
    const { ctx, oscillators, bufferSources, resume } = createMockAudioContext('suspended');

    playPunchSwingSfx(activeSettings, ctx);
    playKickSwingSfx(activeSettings, ctx);
    playAttackHitSfx(activeSettings, 'high', false, {}, ctx);
    playAttackHitSfx(activeSettings, 'low', false, {}, ctx);
    playAttackHitSfx(activeSettings, 'low', true, {}, ctx);

    expect(resume).toHaveBeenCalled();
    expect(oscillators.length).toBeGreaterThanOrEqual(6);
    expect(bufferSources.length).toBeGreaterThanOrEqual(5);
    oscillators.forEach((osc) => {
      expect(osc.start).toHaveBeenCalledTimes(1);
      expect(osc.stop).toHaveBeenCalledTimes(1);
    });
  });

  it('plays character-specific special charge, execute, and impact SFX', () => {
    const characters = ['maki', 'gojo', 'naruto', 'goku', 'luffy', 'tanjiro', 'ichigo', 'ariungerel'];

    for (const characterId of characters) {
      const { ctx, oscillators, bufferSources } = createMockAudioContext();

      playSpecialChargeSfx(activeSettings, characterId, ctx);
      playSpecialExecuteSfx(activeSettings, characterId, ctx);
      playAttackHitSfx(activeSettings, 'special', false, { characterId, finisher: true }, ctx);

      expect(oscillators.length + bufferSources.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('skips scheduling when muted or sfxVolume is zero', () => {
    const { ctx, oscillators, bufferSources } = createMockAudioContext();

    const muted: GameSettings = { sfxVolume: 0.9, musicVolume: 0.5, muted: true };
    const zeroSfx: GameSettings = { sfxVolume: 0, musicVolume: 0.5, muted: false };

    playPunchSwingSfx(muted, ctx);
    playKickSwingSfx(zeroSfx, ctx);
    playSpecialChargeSfx(muted, 'gojo', ctx);
    playSpecialExecuteSfx(zeroSfx, 'maki', ctx);
    playAttackHitSfx(muted, 'special', false, { characterId: 'goku' }, ctx);

    expect(oscillators.length).toBe(0);
    expect(bufferSources.length).toBe(0);
  });
});
