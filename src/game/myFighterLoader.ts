import type * as Phaser from 'phaser';

import type { CharacterDefinition, HeroBoundsFrame } from './hero';
import {
  buildFighterCharacter,
  collisionBounds,
  hitBounds,
  rect,
  type FighterActionSpec
} from './fighterCharacter';
import { MY_FIGHTERS, type MyFighter, type MyFighterSheetSlot } from './myFighters';
import {
  RAW_CELL,
  frameToCanvas,
  loadFirstImage,
  placeholderRawSheet,
  reverseRawSheet,
  sliceRawSheet,
  type RawSheet
} from './rawSheet';
import type { Rect } from './types';

/**
 * Fighters listed in `myFighters.ts` are built from raw AI-drawn pose sheets
 * at runtime (see `rawSheet.ts`) instead of hand-made 256px spritesheets. A
 * missing picture falls back to the next one in its `sources` list, so a
 * fighter works with `idle` alone and improves as pictures are added.
 */

const SHEET_NAMES = ['idle', 'walk', 'punch', 'kick', 'hit', 'ko', 'jump', 'crouch', 'block', 'special'] as const;

type SheetName = (typeof SHEET_NAMES)[number];

interface ActionPlan {
  action: string;
  label: string;
  /** Picture names to try, best first. */
  sources: SheetName[];
  frameRate: number;
  repeat: number;
  reverse?: boolean;
  /** Vertical slice of the frame the attack covers (the reach is measured). */
  attack?: { y: number; height: number };
  guard?: Rect;
}

const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const STANDING = rect(76, 28, 104, 204);
const CROUCHING = rect(72, 104, 112, 126);
const PUNCH_ZONE = { y: 84, height: 46 };
const KICK_ZONE = { y: 48, height: 80 };
const SPECIAL_ZONE = { y: 36, height: 130 };

const ACTION_PLANS: ActionPlan[] = [
  { action: 'idle', label: 'Idle', sources: ['idle'], frameRate: 6, repeat: -1 },
  { action: 'walk-forward', label: 'Walk Forward', sources: ['walk', 'idle'], frameRate: 8, repeat: -1 },
  {
    action: 'walk-backward',
    label: 'Walk Backward',
    sources: ['walk', 'idle'],
    frameRate: 8,
    repeat: -1,
    reverse: true
  },
  { action: 'crouch', label: 'Crouch', sources: ['crouch', 'idle'], frameRate: 10, repeat: 0 },
  { action: 'jump', label: 'Jump', sources: ['jump', 'idle'], frameRate: 8, repeat: 0 },
  {
    action: 'block-high',
    label: 'Block High',
    sources: ['block', 'idle'],
    frameRate: 10,
    repeat: 0,
    guard: rect(60, 44, 136, 116)
  },
  {
    action: 'block-low',
    label: 'Block Low',
    sources: ['block', 'crouch', 'idle'],
    frameRate: 10,
    repeat: 0,
    guard: rect(60, 110, 136, 120)
  },
  { action: 'hit-high', label: 'Hit', sources: ['hit', 'idle'], frameRate: 10, repeat: 0 },
  {
    action: 'light-punch',
    label: 'Punch',
    sources: ['punch', 'idle'],
    frameRate: 12,
    repeat: 0,
    attack: PUNCH_ZONE
  },
  {
    action: 'heavy-kick',
    label: 'Kick',
    sources: ['kick', 'punch', 'idle'],
    frameRate: 10,
    repeat: 0,
    attack: KICK_ZONE
  },
  { action: 'special-charge', label: 'Special Charge', sources: ['crouch', 'idle'], frameRate: 10, repeat: 0 },
  {
    action: 'special',
    label: 'Special',
    sources: ['special', 'kick', 'punch', 'idle'],
    frameRate: 10,
    repeat: 0,
    attack: SPECIAL_ZONE
  },
  { action: 'knockdown', label: 'Knockdown', sources: ['ko', 'hit', 'idle'], frameRate: 8, repeat: 0 }
];

const PLACEHOLDER_FRAMES = 1;

const cachedSheetsByFighter = new Map<string, Map<SheetName, RawSheet | null>>();
const preparedPortraits = new Set<string>();
const preparedFighters = new Set<string>();

function toSpec(plan: ActionPlan): FighterActionSpec {
  return {
    action: plan.action,
    label: plan.label,
    file: `${plan.sources[0]}.png`,
    frames: PLACEHOLDER_FRAMES,
    frameRate: plan.frameRate,
    repeat: plan.repeat,
    defaultVisual: STANDING,
    guard: plan.guard
  };
}

function buildMyFighter(fighter: MyFighter): CharacterDefinition {
  const character = buildFighterCharacter({
    id: fighter.id,
    label: fighter.name,
    assetRoot: `/assets/${fighter.id}`,
    anchorUsage: `${fighter.name} (built from raw pose sheets)`,
    portraitFile: 'portrait.png',
    actions: ACTION_PLANS.map(toSpec)
  });

  // Textures for these assets are made in `myFighterLoader`, not by the Phaser loader.
  character.assets.forEach((asset) => {
    asset.auto = true;
  });

  return character;
}

export const MY_FIGHTER_CHARACTERS: CharacterDefinition[] = MY_FIGHTERS.filter(
  (fighter) => /^[a-z0-9][a-z0-9-]*$/.test(fighter.id)
).map(buildMyFighter);

export const MY_FIGHTER_IDS: string[] = MY_FIGHTER_CHARACTERS.map((character) => character.id);

export function isMyFighter(characterId: string): boolean {
  return MY_FIGHTER_IDS.includes(characterId);
}

export function isMyFighterReady(characterId: string): boolean {
  return preparedFighters.has(characterId);
}

/**
 * Resolves candidate URLs for a fighter sheet slot. When `fighter.files` is
 * defined, only exact listed files are requested (preventing 404 probing).
 */
function resolveSlotUrls(fighter: MyFighter, slot: MyFighterSheetSlot): string[] {
  const root = `/assets/${fighter.id}`;

  if (fighter.files) {
    const file = fighter.files[slot];
    return file ? [`${root}/${file}`] : [];
  }

  return EXTENSIONS.map((extension) => `${root}/${slot}.${extension}`);
}

function getFighterSheetCache(fighterId: string): Map<SheetName, RawSheet | null> {
  let cache = cachedSheetsByFighter.get(fighterId);

  if (!cache) {
    cache = new Map();
    cachedSheetsByFighter.set(fighterId, cache);
  }

  return cache;
}

async function fetchRawSheet(fighter: MyFighter, name: SheetName): Promise<RawSheet | null> {
  const cache = getFighterSheetCache(fighter.id);

  if (cache.has(name)) {
    return cache.get(name) ?? null;
  }

  const urls = resolveSlotUrls(fighter, name);
  const image = urls.length > 0 ? await loadFirstImage(urls) : null;
  const sheet = image ? sliceRawSheet(image, { flip: fighter.flip, frames: fighter.frames?.[name] }) : null;

  cache.set(name, sheet);
  return sheet;
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

/**
 * Fast boot step: fetches and slices ONLY `idle` (and `portrait` if present)
 * for every fighter in `myFighters.ts` in parallel, giving CharacterSelect
 * crisp portraits while deferring full combat sheets until match start.
 */
export async function prepareMyFighterPortraits(
  scene: Phaser.Scene,
  onProgress?: (fraction: number, label: string) => void
): Promise<void> {
  MY_FIGHTERS.filter((fighter) => !MY_FIGHTER_IDS.includes(fighter.id)).forEach((fighter) => {
    console.warn(`[my-fighter] "${fighter.id}" skipped: id must be lowercase english letters, numbers or "-"`);
  });

  const entries = MY_FIGHTER_CHARACTERS.flatMap((character) => {
    const fighter = MY_FIGHTERS.find((candidate) => candidate.id === character.id);
    return fighter ? [{ character, fighter }] : [];
  });

  if (entries.length === 0) {
    onProgress?.(1, 'Fighters ready');
    return;
  }

  // Kick off all portrait + idle image downloads concurrently first.
  const preloadedImages = await Promise.all(
    entries.map(async ({ character, fighter }) => {
      if (preparedPortraits.has(fighter.id)) {
        return { character, fighter, idleImage: null, portraitImage: null, cached: true };
      }

      const portraitUrls = resolveSlotUrls(fighter, 'portrait');
      const idleUrls = resolveSlotUrls(fighter, 'idle');
      const [portraitImage, idleImage] = await Promise.all([
        portraitUrls.length > 0 ? loadFirstImage(portraitUrls) : Promise.resolve(null),
        idleUrls.length > 0 ? loadFirstImage(idleUrls) : Promise.resolve(null)
      ]);

      return { character, fighter, idleImage, portraitImage, cached: false };
    })
  );

  let completed = 0;

  for (const item of preloadedImages) {
    const { character, fighter, idleImage, portraitImage, cached } = item;

    if (!cached) {
      onProgress?.(completed / entries.length, `Preparing ${fighter.name}...`);
      await nextAnimationFrame();

      const cache = getFighterSheetCache(fighter.id);
      let idleSheet = cache.get('idle') ?? null;

      if (!cache.has('idle')) {
        idleSheet = idleImage ? sliceRawSheet(idleImage, { flip: fighter.flip, frames: fighter.frames?.idle }) : null;
        cache.set('idle', idleSheet);
      }

      const idle = idleSheet ?? placeholderRawSheet();
      const fallbackPortrait = cropToPose(idle);

      replaceTexture(scene, character.portrait.key);

      if (portraitImage) {
        scene.textures.addImage(character.portrait.key, portraitImage);
      } else {
        scene.textures.addCanvas(character.portrait.key, fallbackPortrait);
      }

      if (character.anchorAsset.key !== character.portrait.key) {
        replaceTexture(scene, character.anchorAsset.key);
        scene.textures.addCanvas(character.anchorAsset.key, frameToCanvas(idle));
      }

      preparedPortraits.add(fighter.id);
    }

    completed += 1;
    onProgress?.(completed / entries.length, `Prepared ${fighter.name}`);
  }
}

/**
 * Ensures all animation sheets and bounds for a single `myFighters.ts`
 * character are loaded, sliced, and registered in Phaser. Safe and instant
 * if already prepared.
 */
export async function ensureMyFighterReady(
  scene: Phaser.Scene,
  fighterId: string,
  onProgress?: (fraction: number, label: string) => void
): Promise<void> {
  if (preparedFighters.has(fighterId)) {
    onProgress?.(1, `${fighterId} ready`);
    return;
  }

  const character = MY_FIGHTER_CHARACTERS.find((candidate) => candidate.id === fighterId);
  const fighter = MY_FIGHTERS.find((candidate) => candidate.id === fighterId);

  if (!character || !fighter) {
    return;
  }

  await prepareFighter(scene, character, fighter, onProgress);
  preparedFighters.add(fighterId);
}

/**
 * Load, slice and register every picture of the fighters in `myFighters.ts`.
 * Kept for compatibility with full-boot tools.
 * @param scene - The boot scene (owner of the texture manager).
 */
export async function prepareMyFighters(scene: Phaser.Scene): Promise<void> {
  MY_FIGHTERS.filter((fighter) => !MY_FIGHTER_IDS.includes(fighter.id)).forEach((fighter) => {
    console.warn(`[my-fighter] "${fighter.id}" skipped: id must be lowercase english letters, numbers or "-"`);
  });

  for (const character of MY_FIGHTER_CHARACTERS) {
    await ensureMyFighterReady(scene, character.id);
  }
}

async function prepareFighter(
  scene: Phaser.Scene,
  character: CharacterDefinition,
  fighter: MyFighter,
  onProgress?: (fraction: number, label: string) => void
): Promise<void> {
  const cache = getFighterSheetCache(fighter.id);

  // Determine which distinct sheet slots are needed and download all missing ones in parallel.
  const slotsToLoad = SHEET_NAMES.filter((name) => !cache.has(name) && resolveSlotUrls(fighter, name).length > 0);
  const totalSteps = slotsToLoad.length + 1;
  let step = 0;

  onProgress?.(0, `Loading ${fighter.name}...`);

  const downloaded = await Promise.all(
    slotsToLoad.map(async (name) => {
      const urls = resolveSlotUrls(fighter, name);
      const image = await loadFirstImage(urls);
      step += 1;
      onProgress?.((step / totalSteps) * 0.55, `Loading ${fighter.name} (${name})...`);
      return { name, image };
    })
  );

  // Mark slots without candidate URLs as null so we don't probe them later.
  SHEET_NAMES.forEach((name) => {
    if (!cache.has(name) && resolveSlotUrls(fighter, name).length === 0) {
      cache.set(name, null);
    }
  });

  // Slice downloaded sheets sequentially with frame yields so UI stays smooth.
  for (let index = 0; index < downloaded.length; index += 1) {
    const { name, image } = downloaded[index];
    const sheet = image ? sliceRawSheet(image, { flip: fighter.flip, frames: fighter.frames?.[name] }) : null;
    cache.set(name, sheet);
    onProgress?.(0.55 + ((index + 1) / Math.max(1, downloaded.length)) * 0.45, `Slicing ${fighter.name}...`);
    await nextAnimationFrame();
  }

  for (const plan of ACTION_PLANS) {
    const animation = character.animations.find((candidate) => candidate.action === plan.action);

    if (!animation) {
      continue;
    }

    let used: SheetName | null = null;
    let sheet: RawSheet | null = null;

    for (const name of plan.sources) {
      const candidate = await fetchRawSheet(fighter, name);

      if (candidate) {
        sheet = candidate;
        used = name;
        break;
      }
    }

    if (!sheet) {
      sheet = placeholderRawSheet();
    }

    if (plan.reverse) {
      sheet = reverseRawSheet(sheet);
    }

    animation.sheet.frames = sheet.frames;
    animation.bounds = buildBounds(sheet, plan, used, fighter);
    addSheetTexture(scene, animation.sheet.key, sheet);
  }

  if (!preparedPortraits.has(fighter.id)) {
    const portraitUrls = resolveSlotUrls(fighter, 'portrait');
    const portrait = portraitUrls.length > 0 ? await loadFirstImage(portraitUrls) : null;
    const idle = cache.get('idle') ?? placeholderRawSheet();
    const fallbackPortrait = cropToPose(idle);

    replaceTexture(scene, character.portrait.key);

    if (portrait) {
      scene.textures.addImage(character.portrait.key, portrait);
    } else {
      scene.textures.addCanvas(character.portrait.key, fallbackPortrait);
    }

    if (character.anchorAsset.key !== character.portrait.key) {
      replaceTexture(scene, character.anchorAsset.key);
      scene.textures.addCanvas(character.anchorAsset.key, frameToCanvas(idle));
    }

    preparedPortraits.add(fighter.id);
  }

  const report = SHEET_NAMES.map((name) => `${name} ${cache.get(name)?.frames ?? '-'}`);
  console.info(`[my-fighter] ${fighter.id}: ${report.join(', ')}   (number = poses found, "-" = no picture)`);

  if (!cache.get('idle')) {
    console.warn(`[my-fighter] ${fighter.id}: public/assets/${fighter.id}/idle.png not found or has no pose in it`);
  }

  onProgress?.(1, `${fighter.name} ready`);
}

function buildBounds(sheet: RawSheet, plan: ActionPlan, used: SheetName | null, fighter: MyFighter): HeroBoundsFrame[] {
  const body = used === 'crouch' ? CROUCHING : STANDING;
  const active = plan.attack
    ? plan.action === 'special' && fighter.specialFrames
      ? fighter.specialFrames.filter((frame) => frame >= 0 && frame < sheet.frames)
      : attackFrames(sheet)
    : [];
  const extraReach = plan.action === 'special' ? Math.max(0, fighter.specialReach ?? 0) : 0;

  return sheet.boxes.map((box, frame) => ({
    frame,
    visual: { ...box },
    collision: collisionBounds(body, RAW_CELL, RAW_CELL),
    hit: hitBounds(box, RAW_CELL, RAW_CELL),
    attack:
      plan.attack && active.includes(frame)
        ? rect(box.x - extraReach, plan.attack.y, Math.max(48, RAW_CELL / 2 - 10 - box.x) + extraReach, plan.attack.height)
        : null,
    guard: plan.guard ? { ...plan.guard } : null
  }));
}

/**
 * The frames where the attack can land: those where the pose reaches furthest
 * forward (fighters face left, so "forward" is the left edge of the pose).
 */
function attackFrames(sheet: RawSheet): number[] {
  const reaches = sheet.boxes.map((box) => RAW_CELL / 2 - box.x);
  const furthest = Math.max(...reaches);

  if (furthest - Math.min(...reaches) < 15) {
    return [Math.floor(sheet.frames / 2)];
  }

  return reaches.flatMap((reach, frame) => (reach >= furthest - 12 ? [frame] : []));
}

function addSheetTexture(scene: Phaser.Scene, key: string, sheet: RawSheet): void {
  replaceTexture(scene, key);
  // Phaser accepts a canvas here at runtime; the typings only list images.
  scene.textures.addSpriteSheet(key, sheet.canvas as unknown as HTMLImageElement, {
    frameWidth: RAW_CELL,
    frameHeight: RAW_CELL,
    startFrame: 0,
    endFrame: sheet.frames - 1
  });
}

function replaceTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
}

/** First idle pose, cropped square around the body, for the select card. */
function cropToPose(sheet: RawSheet): HTMLCanvasElement {
  const box = sheet.boxes[0];
  const size = Math.max(box.width, box.height) + 16;
  const canvas = document.createElement('canvas');

  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext('2d')
    ?.drawImage(
      frameToCanvas(sheet),
      box.x,
      box.y,
      box.width,
      box.height,
      Math.round((size - box.width) / 2),
      Math.round((size - box.height) / 2),
      box.width,
      box.height
    );

  return canvas;
}
