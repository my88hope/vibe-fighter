import { getEffectiveVolume } from './core/audio';
import type { Store } from './store';
import type { GameSettings } from './types';

export const YOUTUBE_BGM_URL =
  'https://www.youtube.com/watch?v=mRN_T6JkH-c&list=PLwJjxqYuirCLkq42mGw4XKGQlpZSfxsYd';

export interface YouTubeBgmTrack {
  videoId: string;
  playlistId: string | null;
}

export interface BackgroundMusicController {
  destroy(): void;
}

const YT_PLAYER_STATE = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3
} as const;

const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';

interface YouTubePlayerInstance {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  getPlayerState(): number;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

interface YouTubePlayerConstructor {
  new (
    element: HTMLElement | string,
    options: {
      width?: number | string;
      height?: number | string;
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YouTubePlayerInstance }) => void;
        onStateChange?: (event: { target: YouTubePlayerInstance; data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    }
  ): YouTubePlayerInstance;
}

declare global {
  interface Window {
    YT?: {
      Player?: YouTubePlayerConstructor;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function parseYouTubeBgmTrack(url: string): YouTubeBgmTrack {
  try {
    const parsed = new URL(url);
    const videoId = parsed.searchParams.get('v')?.trim() ?? '';
    const playlistId = parsed.searchParams.get('list')?.trim() || null;

    if (videoId) {
      return { videoId, playlistId };
    }
  } catch {
    // Fall back to default video ID if URL parsing fails.
  }

  return {
    videoId: 'mRN_T6JkH-c',
    playlistId: 'PLwJjxqYuirCLkq42mGw4XKGQlpZSfxsYd'
  };
}

export function toYouTubeVolumePercent(settings: GameSettings): number {
  const effective = getEffectiveVolume(1, 'music', settings);
  return Math.max(0, Math.min(100, Math.round(effective * 100)));
}

let apiLoadPromise: Promise<YouTubePlayerConstructor | null> | null = null;

function loadYouTubeIframeApi(): Promise<YouTubePlayerConstructor | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT.Player);
  }

  if (apiLoadPromise) {
    return apiLoadPromise;
  }

  apiLoadPromise = new Promise<YouTubePlayerConstructor | null>((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    let settled = false;

    const finish = (playerCtor: YouTubePlayerConstructor | null): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(playerCtor);
    };

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      finish(window.YT?.Player ?? null);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${YOUTUBE_IFRAME_API_SRC}"]`
    );

    if (existingScript) {
      existingScript.addEventListener('error', () => finish(null), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = YOUTUBE_IFRAME_API_SRC;
    script.async = true;
    script.onerror = () => finish(null);
    document.head.appendChild(script);
  });

  return apiLoadPromise;
}

export function createYouTubeBackgroundMusic(
  settingsStore: Store<GameSettings>,
  trackUrl: string = YOUTUBE_BGM_URL
): BackgroundMusicController {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { destroy: () => undefined };
  }

  const track = parseYouTubeBgmTrack(trackUrl);
  const host = document.createElement('div');
  host.className = 'yt-bgm-host';
  host.setAttribute('aria-hidden', 'true');

  const mount = document.createElement('div');
  host.appendChild(mount);
  document.body.appendChild(host);

  let player: YouTubePlayerInstance | null = null;
  let isReady = false;
  let isPlaying = false;
  let pausedByVisibility = false;
  let destroyed = false;
  let latestSettings = settingsStore.getState();

  const applyVolume = (settings: GameSettings): number => {
    const percent = toYouTubeVolumePercent(settings);

    if (!player || !isReady) {
      return percent;
    }

    if (percent <= 0) {
      player.mute();
      player.setVolume(0);
    } else {
      player.unMute();
      player.setVolume(percent);
    }

    return percent;
  };

  const syncPlayback = (settings: GameSettings): void => {
    latestSettings = settings;

    if (!player || !isReady || destroyed) {
      return;
    }

    const percent = applyVolume(settings);

    if (percent <= 0) {
      if (isPlaying) {
        player.pauseVideo();
      }
      return;
    }

    if (document.hidden) {
      return;
    }

    const state = player.getPlayerState?.();
    if (state !== YT_PLAYER_STATE.PLAYING && state !== YT_PLAYER_STATE.BUFFERING) {
      player.playVideo();
    }
  };

  const handleUserGesture = (): void => {
    if (destroyed || !isReady || isPlaying) {
      return;
    }

    if (toYouTubeVolumePercent(latestSettings) > 0 && !document.hidden) {
      syncPlayback(latestSettings);
    }
  };

  const removeGestureListeners = (): void => {
    window.removeEventListener('pointerdown', handleUserGesture, true);
    window.removeEventListener('keydown', handleUserGesture, true);
    window.removeEventListener('touchstart', handleUserGesture, true);
  };

  window.addEventListener('pointerdown', handleUserGesture, { capture: true, passive: true });
  window.addEventListener('keydown', handleUserGesture, { capture: true, passive: true });
  window.addEventListener('touchstart', handleUserGesture, { capture: true, passive: true });

  const handleVisibilityChange = (): void => {
    if (!player || !isReady || destroyed) {
      return;
    }

    if (document.hidden) {
      if (isPlaying) {
        pausedByVisibility = true;
        player.pauseVideo();
      }
      return;
    }

    if (pausedByVisibility) {
      pausedByVisibility = false;
      syncPlayback(latestSettings);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  const unsubscribeSettings = settingsStore.subscribe((settings) => {
    syncPlayback(settings);
  });

  void loadYouTubeIframeApi().then((PlayerCtor) => {
    if (destroyed || !PlayerCtor) {
      return;
    }

    player = new PlayerCtor(mount, {
      width: 200,
      height: 200,
      videoId: track.videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        loop: 1,
        modestbranding: 1,
        playsinline: 1,
        playlist: track.videoId,
        rel: 0,
        origin: window.location.origin
      },
      events: {
        onReady: ({ target }) => {
          if (destroyed) {
            target.destroy();
            return;
          }

          isReady = true;

          try {
            const iframe = target.getIframe();
            iframe.tabIndex = -1;
            iframe.setAttribute('aria-hidden', 'true');
            iframe.allow = 'autoplay; encrypted-media';
          } catch {
            // Ignore if iframe element cannot be accessed.
          }

          syncPlayback(latestSettings);
        },
        onStateChange: ({ target, data }) => {
          if (destroyed) {
            return;
          }

          if (data === YT_PLAYER_STATE.PLAYING) {
            isPlaying = true;
            pausedByVisibility = false;
            applyVolume(latestSettings);
            removeGestureListeners();
            return;
          }

          if (data === YT_PLAYER_STATE.PAUSED) {
            isPlaying = false;
            return;
          }

          if (data === YT_PLAYER_STATE.ENDED) {
            isPlaying = false;

            if (toYouTubeVolumePercent(latestSettings) > 0 && !document.hidden) {
              target.seekTo(0, true);
              target.playVideo();
            }
          }
        },
        onError: () => {
          isPlaying = false;
        }
      }
    });
  });

  return {
    destroy: () => {
      if (destroyed) {
        return;
      }

      destroyed = true;
      removeGestureListeners();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribeSettings();

      try {
        player?.destroy();
      } catch {
        // Ignore teardown errors from unloaded YT player.
      }

      player = null;
      host.remove();
    }
  };
}
