import * as Phaser from 'phaser';

import {
  STARTER_AUDIO_ASSETS,
  STARTER_AUDIO_CUES,
  type GeneratedAudioCue,
  type StarterAudioAsset
} from './core/audio';
import { GENERATED_TEXTURE_ASSETS, type GeneratedTextureAsset } from './generatedAssets';
import {
  CHARACTER_ANIMATIONS,
  CHARACTER_ASSETS,
  CHARACTER_DEFINITIONS,
  getCharacterDefinition
} from './hero';
import { ensureMyFighterReady, isMyFighter } from './myFighterLoader';
import { STAGE_IMAGE_ASSETS } from './stageConfig';
import { TILE_ATLAS_IMAGE_URL, TILE_ATLAS_TEXTURE_KEY, TILE_ATLAS_SIZE } from './tileAtlas';
import {
  QUEST_UI_ATLAS_IMAGE_URL,
  QUEST_UI_ATLAS_SIZE,
  QUEST_UI_ATLAS_TEXTURE_KEY
} from './uiAtlas';
import {
  FIGHTING_UI_ATLAS_IMAGE_URL,
  FIGHTING_UI_ATLAS_SIZE,
  FIGHTING_UI_ATLAS_TEXTURE_KEY
} from './fightingUiAtlas';

export interface ImageAsset {
  kind: 'image';
  key: string;
  url: string;
  width?: number;
  height?: number;
  usage?: string;
  /** Texture is created in code (see myFighterLoader), not loaded from `url`. */
  auto?: boolean;
}

export interface AtlasAsset {
  kind: 'atlas';
  key: string;
  url: string;
  atlasUrl: string;
  width?: number;
  height?: number;
  usage?: string;
}

export interface SpritesheetAsset {
  kind: 'spritesheet';
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  margin?: number;
  spacing?: number;
  /** Texture is created in code (see myFighterLoader), not loaded from `url`. */
  auto?: boolean;
}

export interface AudioAsset {
  kind: 'audio';
  key: string;
  url: string;
  category?: 'music' | 'sfx';
  durationSeconds?: number;
  volume?: number;
  loop?: boolean;
  usage?: string;
}

export interface BackgroundLayerAsset {
  key: string;
  label: string;
  speed: number;
  tileOffsetY: number;
}

export type StarterAsset = ImageAsset | SpritesheetAsset | AtlasAsset | AudioAsset;

export const TILE_IMAGE_ASSETS: ImageAsset[] = [
  {
    kind: 'image',
    key: TILE_ATLAS_TEXTURE_KEY,
    url: TILE_ATLAS_IMAGE_URL,
    width: TILE_ATLAS_SIZE.width,
    height: TILE_ATLAS_SIZE.height,
    usage: 'quest platformer tile and object atlas'
  }
];

export const UI_IMAGE_ASSETS: ImageAsset[] = [
  {
    kind: 'image',
    key: QUEST_UI_ATLAS_TEXTURE_KEY,
    url: QUEST_UI_ATLAS_IMAGE_URL,
    width: QUEST_UI_ATLAS_SIZE.width,
    height: QUEST_UI_ATLAS_SIZE.height,
    usage: 'quest HUD portraits, health bars, coin counters, and game status icons'
  },
  {
    kind: 'image',
    key: FIGHTING_UI_ATLAS_TEXTURE_KEY,
    url: FIGHTING_UI_ATLAS_IMAGE_URL,
    width: FIGHTING_UI_ATLAS_SIZE.width,
    height: FIGHTING_UI_ATLAS_SIZE.height,
    usage: 'fighting HUD health bars, portrait frames, timer, meter pips, and status icons'
  }
];

export const FIGHTING_UI_IMAGE_ASSETS: ImageAsset[] = UI_IMAGE_ASSETS.filter(
  (asset) => asset.key === FIGHTING_UI_ATLAS_TEXTURE_KEY
);

export const BUNDLED_PORTRAIT_ASSETS: ImageAsset[] = CHARACTER_DEFINITIONS.filter(
  (character) => !isMyFighter(character.id) && !character.portrait.auto
).map((character) => character.portrait);

export const MODE_CARD_IMAGE_ASSETS: ImageAsset[] = [];

/**
 * Lightweight boot asset set: fighting UI atlas, audio cues, all 10 stage
 * previews, and bundled fighter portraits. Full combat spritesheets are loaded
 * on demand for the two chosen match fighters so startup is near-instant.
 */
export const BOOT_ASSETS: StarterAsset[] = [
  ...FIGHTING_UI_IMAGE_ASSETS,
  ...STARTER_AUDIO_ASSETS,
  ...STAGE_IMAGE_ASSETS,
  ...BUNDLED_PORTRAIT_ASSETS
];

export const STARTER_ASSETS: StarterAsset[] = [
  ...CHARACTER_ASSETS,
  ...TILE_IMAGE_ASSETS,
  ...UI_IMAGE_ASSETS,
  ...STAGE_IMAGE_ASSETS,
  ...STARTER_AUDIO_ASSETS
];

export const SAMPLE_BACKGROUND_LAYERS: BackgroundLayerAsset[] = [
  { key: 'sample-bg-sky', label: 'Sky', speed: 4, tileOffsetY: 0 },
  { key: 'sample-bg-far', label: 'Far', speed: 14, tileOffsetY: 30 },
  { key: 'sample-bg-mid', label: 'Mid', speed: 28, tileOffsetY: 80 }
];

export const ASSET_CATALOG: Array<
  StarterAsset | StarterAudioAsset | GeneratedAudioCue | GeneratedTextureAsset
> = [
  ...STARTER_ASSETS,
  ...STARTER_AUDIO_CUES,
  ...GENERATED_TEXTURE_ASSETS
];

export function preloadStarterAssets(scene: Phaser.Scene, assets: StarterAsset[] = STARTER_ASSETS): void {
  assets.forEach((asset) => {
    if ((asset.kind === 'image' || asset.kind === 'spritesheet') && asset.auto) {
      return;
    }

    if (asset.kind === 'image') {
      if (!scene.textures.exists(asset.key)) {
        scene.load.image(asset.key, asset.url);
      }

      return;
    }

    if (asset.kind === 'spritesheet') {
      if (!scene.textures.exists(asset.key)) {
        scene.load.spritesheet(asset.key, asset.url, {
          frameWidth: asset.frameWidth,
          frameHeight: asset.frameHeight,
          startFrame: 0,
          endFrame: asset.frames - 1,
          margin: asset.margin ?? 0,
          spacing: asset.spacing ?? 0
        });
      }

      return;
    }

    if (asset.kind === 'atlas') {
      if (!scene.textures.exists(asset.key)) {
        scene.load.atlas(asset.key, asset.url, asset.atlasUrl);
      }

      return;
    }

    if (!scene.cache.audio.exists(asset.key)) {
      scene.load.audio(asset.key, asset.url);
    }
  });
}

export function registerCharacterAnimations(scene: Phaser.Scene, characterId: string): void {
  const character = getCharacterDefinition(characterId);

  character.animations.forEach((animation) => {
    if (scene.anims.exists(animation.key) || !scene.textures.exists(animation.sheet.key)) {
      return;
    }

    scene.anims.create({
      key: animation.key,
      frames: scene.anims.generateFrameNumbers(animation.sheet.key, {
        start: 0,
        end: animation.sheet.frames - 1
      }),
      frameRate: animation.frameRate,
      repeat: animation.repeat
    });
  });
}

export function registerStarterAnimations(scene: Phaser.Scene): void {
  CHARACTER_ANIMATIONS.forEach((animation) => {
    if (scene.anims.exists(animation.key) || !scene.textures.exists(animation.sheet.key)) {
      return;
    }

    scene.anims.create({
      key: animation.key,
      frames: scene.anims.generateFrameNumbers(animation.sheet.key, {
        start: 0,
        end: animation.sheet.frames - 1
      }),
      frameRate: animation.frameRate,
      repeat: animation.repeat
    });
  });
}

/**
 * Loads only the spritesheets/raw pose sheets and registers animations for
 * the given character ids (typically P1 and P2 at match start). Instantaneous
 * when already cached in Phaser's texture manager.
 */
export async function ensureFightersReady(
  scene: Phaser.Scene,
  characterIds: string[],
  onProgress?: (fraction: number, label: string) => void
): Promise<void> {
  const uniqueIds = Array.from(new Set(characterIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    onProgress?.(1, 'Fighters ready');
    return;
  }

  const bundledToLoad: StarterAsset[] = [];
  const myFightersToLoad: string[] = [];

  uniqueIds.forEach((id) => {
    if (isMyFighter(id)) {
      myFightersToLoad.push(id);
      return;
    }

    const character = getCharacterDefinition(id);
    character.assets.forEach((asset) => {
      if (!asset.auto && !scene.textures.exists(asset.key)) {
        bundledToLoad.push(asset);
      }
    });
  });

  const hasBundled = bundledToLoad.length > 0;
  const bundledWeight = hasBundled ? 0.5 : 0;
  const myFighterWeight = 1 - bundledWeight;

  if (hasBundled) {
    await new Promise<void>((resolve) => {
      preloadStarterAssets(scene, bundledToLoad);

      const handleProgress = (value: number): void => {
        onProgress?.(value * bundledWeight, 'Loading fighter spritesheets...');
      };
      const handleComplete = (): void => {
        scene.load.off(Phaser.Loader.Events.PROGRESS, handleProgress);
        resolve();
      };

      scene.load.on(Phaser.Loader.Events.PROGRESS, handleProgress);
      scene.load.once(Phaser.Loader.Events.COMPLETE, handleComplete);
      scene.load.start();
    });
  }

  for (let index = 0; index < myFightersToLoad.length; index += 1) {
    const id = myFightersToLoad[index];
    const base = bundledWeight + (index / Math.max(1, myFightersToLoad.length)) * myFighterWeight;
    const span = myFighterWeight / Math.max(1, myFightersToLoad.length);

    await ensureMyFighterReady(scene, id, (subFraction, label) => {
      onProgress?.(base + subFraction * span, label);
    });
  }

  uniqueIds.forEach((id) => registerCharacterAnimations(scene, id));
  onProgress?.(1, 'Fighters ready');
}
