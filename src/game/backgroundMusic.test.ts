import { describe, expect, it } from 'vitest';

import {
  YOUTUBE_BGM_URL,
  parseYouTubeBgmTrack,
  toYouTubeVolumePercent
} from './backgroundMusic';

describe('parseYouTubeBgmTrack', () => {
  it('extracts video and playlist IDs from the configured YouTube URL', () => {
    expect(parseYouTubeBgmTrack(YOUTUBE_BGM_URL)).toEqual({
      videoId: 'mRN_T6JkH-c',
      playlistId: 'PLwJjxqYuirCLkq42mGw4XKGQlpZSfxsYd'
    });
  });

  it('falls back to the default track on invalid URLs', () => {
    expect(parseYouTubeBgmTrack('not a url')).toEqual({
      videoId: 'mRN_T6JkH-c',
      playlistId: 'PLwJjxqYuirCLkq42mGw4XKGQlpZSfxsYd'
    });
  });
});

describe('toYouTubeVolumePercent', () => {
  it('maps musicVolume to a 0-100 YouTube percentage', () => {
    expect(toYouTubeVolumePercent({ sfxVolume: 0.8, musicVolume: 0.55, muted: false })).toBe(55);
    expect(toYouTubeVolumePercent({ sfxVolume: 0.8, musicVolume: 1, muted: false })).toBe(100);
  });

  it('returns 0 when muted', () => {
    expect(toYouTubeVolumePercent({ sfxVolume: 0.8, musicVolume: 0.75, muted: true })).toBe(0);
  });
});
