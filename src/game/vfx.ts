import * as Phaser from 'phaser';

import { FIGHTING_UI_ATLAS_TEXTURE_KEY } from './fightingUiAtlas';

/** Render depth for combat VFX: above fighters, below the HUD. */
const VFX_DEPTH = 90;

/** Tint/spark colour keyed to the kind of impact. */
export type VfxColor = 'red' | 'gold' | 'blue';

const SPARK_FRAME: Record<VfxColor, string> = {
  red: 'icon-hit-red',
  gold: 'icon-hit-gold',
  blue: 'icon-hit-blue'
};

const FLASH_TINT: Record<VfxColor, number> = {
  red: 0xff5a5a,
  gold: 0xffd24a,
  blue: 0x7ec8ff
};

/**
 * Spawns a short-lived hit spark (an atlas impact icon) at a contact point that
 * pops in, scales up, and fades out. Used when an attack connects.
 * @param scene - The owning scene.
 * @param x - World x of the contact point.
 * @param y - World y of the contact point.
 * @param color - Spark colour (red clean hit, blue blocked, gold finisher).
 * @param scale - Peak display scale of the spark (default 1).
 */
export function spawnHitSpark(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: VfxColor = 'red',
  scale = 1
): void {
  const frame = SPARK_FRAME[color];
  if (!scene.textures.exists(FIGHTING_UI_ATLAS_TEXTURE_KEY)) {
    spawnImpactFlash(scene, x, y, color, 40 * scale);
    return;
  }

  const spark = scene.add
    .image(x, y, FIGHTING_UI_ATLAS_TEXTURE_KEY, frame)
    .setDepth(VFX_DEPTH)
    .setScrollFactor(1)
    .setScale(0.2 * scale)
    .setAngle(Phaser.Math.Between(-30, 30))
    .setAlpha(1);

  scene.tweens.add({
    targets: spark,
    scale: scale,
    alpha: 0,
    duration: 220,
    ease: 'Cubic.Out',
    onComplete: () => spark.destroy()
  });

  spawnImpactFlash(scene, x, y, color, 34 * scale);
}

/**
 * Spawns an expanding ring flash at a point that fades as it grows.
 * @param scene - The owning scene.
 * @param x - World x of the flash centre.
 * @param y - World y of the flash centre.
 * @param color - Flash tint.
 * @param radius - Peak radius in world pixels.
 */
export function spawnImpactFlash(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: VfxColor,
  radius = 40
): void {
  const ring = scene.add
    .circle(x, y, radius * 0.3, FLASH_TINT[color], 0.55)
    .setDepth(VFX_DEPTH - 1)
    .setScrollFactor(1);

  scene.tweens.add({
    targets: ring,
    scale: 2.4,
    alpha: 0,
    duration: 260,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy()
  });
}

/**
 * Spawns a special-move charge burst around a fighter: concentric rings that
 * expand outward and fade, telegraphing the wind-up before the move executes.
 * @param scene - The owning scene.
 * @param x - World x of the fighter's centre.
 * @param y - World y of the fighter's centre (roughly mid-body).
 * @param color - Aura colour.
 */
export function spawnChargeAura(scene: Phaser.Scene, x: number, y: number, color: VfxColor = 'gold'): void {
  for (let index = 0; index < 3; index += 1) {
    const ring = scene.add
      .circle(x, y, 18, FLASH_TINT[color], 0)
      .setStrokeStyle(4, FLASH_TINT[color], 0.9)
      .setDepth(VFX_DEPTH - 1)
      .setScrollFactor(1)
      .setScale(1.6);

    scene.tweens.add({
      targets: ring,
      scale: 0.2,
      alpha: 0,
      delay: index * 120,
      duration: 420,
      ease: 'Sine.In',
      onComplete: () => ring.destroy()
    });
  }
}

/**
 * Spawns a sweeping katana arc in front of the fighter when unleashing a blade
 * special (e.g. Maki's Split Soul Katana).
 * @param scene - The owning scene.
 * @param x - World x near the blade sweep centre.
 * @param y - World y near mid-torso.
 * @param facing - Attacker facing (+1 right, -1 left).
 */
export function spawnKatanaSwing(scene: Phaser.Scene, x: number, y: number, facing: 1 | -1): void {
  const arc = scene.add.graphics({ x, y }).setDepth(VFX_DEPTH).setScrollFactor(1);
  const startAngle = facing === 1 ? -0.95 : Math.PI + 0.95;
  const endAngle = facing === 1 ? 0.85 : Math.PI - 0.85;
  const anticlockwise = facing === -1;

  arc.lineStyle(18, 0x38bdf8, 0.35);
  arc.beginPath();
  arc.arc(0, 0, 86, startAngle, endAngle, anticlockwise);
  arc.strokePath();

  arc.lineStyle(8, 0xffffff, 0.95);
  arc.beginPath();
  arc.arc(0, 0, 88, startAngle, endAngle, anticlockwise);
  arc.strokePath();

  arc.setScale(0.75, 0.75);

  scene.tweens.add({
    targets: arc,
    scaleX: 1.25,
    scaleY: 1.15,
    alpha: 0,
    duration: 240,
    ease: 'Cubic.Out',
    onComplete: () => arc.destroy()
  });
}

/**
 * Spawns a sharp soul-blade slash across the struck fighter when Maki's
 * Split Soul Katana connects.
 * @param scene - The owning scene.
 * @param x - World x of the cut centre.
 * @param y - World y of the cut centre.
 * @param facing - Attacker facing (+1 right, -1 left).
 * @param blocked - Whether the slash was guarded.
 */
export function spawnKatanaSlice(
  scene: Phaser.Scene,
  x: number,
  y: number,
  facing: 1 | -1,
  blocked: boolean
): void {
  const edgeColor = blocked ? 0x7ec8ff : 0xf43f5e;
  const angle = facing === 1 ? -28 : 28;

  const auraSlash = scene.add
    .rectangle(x, y, 210, blocked ? 10 : 18, edgeColor, 0.75)
    .setAngle(angle)
    .setDepth(VFX_DEPTH + 1)
    .setScrollFactor(1)
    .setScale(0.3, 1);

  const coreSlash = scene.add
    .rectangle(x, y, 220, blocked ? 4 : 7, 0xffffff, 1)
    .setAngle(angle)
    .setDepth(VFX_DEPTH + 2)
    .setScrollFactor(1)
    .setScale(0.3, 1);

  scene.tweens.add({
    targets: [auraSlash, coreSlash],
    scaleX: 1.35,
    scaleY: 0.15,
    alpha: 0,
    duration: 260,
    ease: 'Cubic.Out',
    onComplete: () => {
      auraSlash.destroy();
      coreSlash.destroy();
    }
  });
}

/** Accent colour per anime character for super cut-in highlights. */
export const SPECIAL_ACCENT_COLOR: Record<string, number> = {
  maki: 0xf43f5e,
  gojo: 0xa855f7,
  naruto: 0x38bdf8,
  goku: 0x60a5fa,
  luffy: 0xef4444,
  tanjiro: 0x06b6d4,
  ichigo: 0xdc2626
};

/**
 * Gojo — Hollow Purple: blue and red spheres converge into a surging violet void
 * sphere with shockwave rings blasting forward.
 */
export function spawnHollowPurple(scene: Phaser.Scene, x: number, y: number, facing: 1 | -1): void {
  const redOrb = scene.add.circle(x - facing * 18, y - 24, 14, 0xf43f5e, 0.9).setDepth(VFX_DEPTH);
  const blueOrb = scene.add.circle(x - facing * 18, y + 24, 14, 0x38bdf8, 0.9).setDepth(VFX_DEPTH);

  scene.tweens.add({
    targets: [redOrb, blueOrb],
    x: x + facing * 16,
    y,
    scale: 0.5,
    duration: 110,
    ease: 'Cubic.In',
    onComplete: () => {
      redOrb.destroy();
      blueOrb.destroy();

      const outerHalo = scene.add
        .circle(x + facing * 22, y, 40, 0x7e22ce, 0.45)
        .setStrokeStyle(5, 0xe879f9, 0.95)
        .setDepth(VFX_DEPTH);
      const midOrb = scene.add.circle(x + facing * 22, y, 26, 0xa855f7, 0.9).setDepth(VFX_DEPTH + 1);
      const core = scene.add.circle(x + facing * 22, y, 13, 0xfdf4ff, 1).setDepth(VFX_DEPTH + 2);

      scene.tweens.add({
        targets: [outerHalo, midOrb, core],
        x: x + facing * 280,
        scale: 1.55,
        alpha: 0,
        duration: 360,
        ease: 'Cubic.Out',
        onComplete: () => {
          outerHalo.destroy();
          midOrb.destroy();
          core.destroy();
        }
      });

      for (let i = 0; i < 3; i += 1) {
        const ring = scene.add
          .ellipse(x + facing * (55 + i * 75), y, 16, 68, 0xc084fc, 0)
          .setStrokeStyle(4, 0xe879f9, 0.85)
          .setDepth(VFX_DEPTH);

        scene.tweens.add({
          targets: ring,
          scaleX: 1.8,
          scaleY: 1.5,
          alpha: 0,
          delay: i * 55,
          duration: 260,
          ease: 'Cubic.Out',
          onComplete: () => ring.destroy()
        });
      }
    }
  });
}

/** Gojo — Hollow Purple impact burst on contact. */
export function spawnHollowPurpleImpact(scene: Phaser.Scene, x: number, y: number, blocked: boolean): void {
  const color = blocked ? 0x93c5fd : 0xc084fc;
  const burst = scene.add
    .circle(x, y, 26, color, 0.7)
    .setStrokeStyle(5, 0xfdf4ff, 0.95)
    .setDepth(VFX_DEPTH + 2);

  scene.tweens.add({
    targets: burst,
    scale: 2.5,
    alpha: 0,
    duration: 280,
    ease: 'Cubic.Out',
    onComplete: () => burst.destroy()
  });
}

/**
 * Naruto — Rasengan: spinning cyan chakra sphere and swirling wind rings
 * surging forward with the lunge.
 */
export function spawnRasengan(scene: Phaser.Scene, x: number, y: number, facing: 1 | -1): void {
  const aura = scene.add
    .circle(x + facing * 16, y, 28, 0x0ea5e9, 0.45)
    .setStrokeStyle(4, 0x7dd3fc, 0.95)
    .setDepth(VFX_DEPTH);
  const core = scene.add.circle(x + facing * 16, y, 15, 0xe0f2fe, 0.95).setDepth(VFX_DEPTH + 1);
  const swirl = scene.add.graphics({ x: x + facing * 16, y }).setDepth(VFX_DEPTH + 2);
  swirl.lineStyle(3, 0xffffff, 0.9);
  swirl.strokeCircle(0, 0, 21);
  swirl.lineStyle(3, 0x38bdf8, 0.9);
  swirl.beginPath();
  swirl.arc(0, 0, 14, 0, Math.PI * 1.4);
  swirl.strokePath();

  scene.tweens.add({
    targets: [aura, core, swirl],
    x: x + facing * 145,
    duration: 280,
    ease: 'Cubic.Out',
    onComplete: () => {
      scene.tweens.add({
        targets: [aura, core, swirl],
        scale: 1.5,
        alpha: 0,
        duration: 150,
        onComplete: () => {
          aura.destroy();
          core.destroy();
          swirl.destroy();
        }
      });
    }
  });

  scene.tweens.add({
    targets: swirl,
    angle: facing * 540,
    duration: 380
  });
}

/** Naruto — Rasengan spiraling wind-vortex burst on hit. */
export function spawnRasenganImpact(scene: Phaser.Scene, x: number, y: number, blocked: boolean): void {
  const color = blocked ? 0x7ec8ff : 0x38bdf8;
  for (let i = 0; i < 2; i += 1) {
    const ring = scene.add
      .circle(x, y, 18 + i * 12, color, 0)
      .setStrokeStyle(5, i === 0 ? 0xffffff : color, 0.95)
      .setDepth(VFX_DEPTH + 2);

    scene.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      delay: i * 50,
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy()
    });
  }
}

/**
 * Goku — Kamehameha: blazing cyan-white energy beam wave and concentric shock
 * rings shooting forward from Goku's palms.
 */
export function spawnKamehameha(scene: Phaser.Scene, x: number, y: number, facing: 1 | -1): void {
  const beamLength = 290;
  const startX = x + facing * 18;
  const originX = facing === 1 ? 0 : 1;

  const sourceOrb = scene.add.circle(startX, y, 24, 0x38bdf8, 0.85).setDepth(VFX_DEPTH + 1);
  const sourceCore = scene.add.circle(startX, y, 13, 0xffffff, 1).setDepth(VFX_DEPTH + 2);

  const beamOuter = scene.add
    .rectangle(startX, y, beamLength, 44, 0x0284c7, 0.72)
    .setOrigin(originX, 0.5)
    .setDepth(VFX_DEPTH)
    .setScale(0.1, 1);

  const beamCore = scene.add
    .rectangle(startX, y, beamLength, 18, 0xf0f9ff, 0.98)
    .setOrigin(originX, 0.5)
    .setDepth(VFX_DEPTH + 1)
    .setScale(0.1, 1);

  scene.tweens.add({
    targets: [beamOuter, beamCore],
    scaleX: 1,
    duration: 120,
    ease: 'Cubic.Out',
    onComplete: () => {
      scene.tweens.add({
        targets: [beamOuter, beamCore, sourceOrb, sourceCore],
        scaleY: 0.15,
        alpha: 0,
        delay: 140,
        duration: 180,
        ease: 'Quad.In',
        onComplete: () => {
          beamOuter.destroy();
          beamCore.destroy();
          sourceOrb.destroy();
          sourceCore.destroy();
        }
      });
    }
  });

  const waveRing = scene.add
    .ellipse(startX + facing * 48, y, 18, 66, 0x7dd3fc, 0)
    .setStrokeStyle(4, 0xe0f2fe, 0.95)
    .setDepth(VFX_DEPTH + 2);

  scene.tweens.add({
    targets: waveRing,
    x: startX + facing * beamLength,
    scaleY: 1.4,
    alpha: 0,
    duration: 280,
    ease: 'Cubic.Out',
    onComplete: () => waveRing.destroy()
  });
}

/** Goku — Kamehameha energy detonation on contact. */
export function spawnKamehamehaImpact(scene: Phaser.Scene, x: number, y: number, blocked: boolean): void {
  const color = blocked ? 0x7ec8ff : 0x38bdf8;
  const flash = scene.add.circle(x, y, 30, color, 0.75).setDepth(VFX_DEPTH + 2);
  const core = scene.add.circle(x, y, 16, 0xffffff, 1).setDepth(VFX_DEPTH + 3);

  scene.tweens.add({
    targets: [flash, core],
    scale: 2.4,
    alpha: 0,
    duration: 270,
    ease: 'Cubic.Out',
    onComplete: () => {
      flash.destroy();
      core.destroy();
    }
  });
}

/**
 * Luffy — Red Hawk: blazing crimson-and-gold fiery punch surge & sonic boom.
 */
export function spawnRedHawk(scene: Phaser.Scene, x: number, y: number, facing: 1 | -1): void {
  const trail = scene.add
    .rectangle(x, y, 145, 26, 0xef4444, 0.78)
    .setOrigin(facing === 1 ? 0 : 1, 0.5)
    .setDepth(VFX_DEPTH)
    .setScale(0.25, 1);

  const core = scene.add
    .rectangle(x, y, 130, 10, 0xfacc15, 0.98)
    .setOrigin(facing === 1 ? 0 : 1, 0.5)
    .setDepth(VFX_DEPTH + 1)
    .setScale(0.25, 1);

  const shockRing = scene.add
    .ellipse(x + facing * 36, y, 16, 58, 0xfb923c, 0)
    .setStrokeStyle(4, 0xfef08a, 0.95)
    .setDepth(VFX_DEPTH + 2);

  scene.tweens.add({
    targets: [trail, core],
    scaleX: 1.15,
    alpha: 0,
    duration: 280,
    ease: 'Cubic.Out',
    onComplete: () => {
      trail.destroy();
      core.destroy();
    }
  });

  scene.tweens.add({
    targets: shockRing,
    x: x + facing * 125,
    scaleY: 1.5,
    alpha: 0,
    duration: 280,
    ease: 'Cubic.Out',
    onComplete: () => shockRing.destroy()
  });

  for (let i = 0; i < 6; i += 1) {
    const ember = scene.add
      .circle(x + facing * (10 + i * 18), y + Phaser.Math.Between(-24, 24), Phaser.Math.Between(4, 8), i % 2 === 0 ? 0xf97316 : 0xfacc15, 0.95)
      .setDepth(VFX_DEPTH + 2);

    scene.tweens.add({
      targets: ember,
      x: ember.x + facing * Phaser.Math.Between(35, 85),
      y: ember.y + Phaser.Math.Between(-28, 22),
      scale: 0.2,
      alpha: 0,
      duration: 300,
      ease: 'Quad.Out',
      onComplete: () => ember.destroy()
    });
  }
}

/** Luffy — Red Hawk fiery explosion on hit. */
export function spawnRedHawkImpact(scene: Phaser.Scene, x: number, y: number, blocked: boolean): void {
  const ringColor = blocked ? 0x7ec8ff : 0xf97316;
  const fire = scene.add
    .circle(x, y, 28, blocked ? 0x38bdf8 : 0xef4444, 0.72)
    .setStrokeStyle(5, ringColor, 0.95)
    .setDepth(VFX_DEPTH + 2);

  scene.tweens.add({
    targets: fire,
    scale: 2.4,
    alpha: 0,
    duration: 260,
    ease: 'Cubic.Out',
    onComplete: () => fire.destroy()
  });
}

/**
 * Tanjiro — Water Breathing Slash: sweeping cyan/azure tidal katana wave and
 * splashing droplets.
 */
export function spawnWaterSlash(scene: Phaser.Scene, x: number, y: number, facing: 1 | -1): void {
  const wave = scene.add.graphics({ x, y }).setDepth(VFX_DEPTH);
  const startAngle = facing === 1 ? -1.1 : Math.PI + 1.1;
  const endAngle = facing === 1 ? 0.95 : Math.PI - 0.95;
  const ccw = facing === -1;

  wave.lineStyle(22, 0x0284c7, 0.55);
  wave.beginPath();
  wave.arc(0, 0, 96, startAngle, endAngle, ccw);
  wave.strokePath();

  wave.lineStyle(12, 0x38bdf8, 0.85);
  wave.beginPath();
  wave.arc(0, 0, 102, startAngle, endAngle, ccw);
  wave.strokePath();

  wave.lineStyle(5, 0xe0f2fe, 1);
  wave.beginPath();
  wave.arc(0, 0, 106, startAngle, endAngle, ccw);
  wave.strokePath();

  wave.setScale(0.65);

  scene.tweens.add({
    targets: wave,
    x: x + facing * 64,
    scaleX: 1.35,
    scaleY: 1.2,
    alpha: 0,
    duration: 300,
    ease: 'Cubic.Out',
    onComplete: () => wave.destroy()
  });

  for (let i = 0; i < 6; i += 1) {
    const drop = scene.add
      .circle(x + facing * 55, y + Phaser.Math.Between(-36, 36), Phaser.Math.Between(3, 6), i % 2 === 0 ? 0x67e8f9 : 0xe0f2fe, 0.95)
      .setDepth(VFX_DEPTH + 1);

    scene.tweens.add({
      targets: drop,
      x: drop.x + facing * Phaser.Math.Between(45, 95),
      y: drop.y + Phaser.Math.Between(-25, 35),
      alpha: 0,
      duration: 290,
      ease: 'Quad.Out',
      onComplete: () => drop.destroy()
    });
  }
}

/** Tanjiro — Water Breathing splash impact on hit. */
export function spawnWaterSlashImpact(scene: Phaser.Scene, x: number, y: number, blocked: boolean): void {
  const color = blocked ? 0x7ec8ff : 0x06b6d4;
  const slash = scene.add
    .rectangle(x, y, 200, blocked ? 10 : 18, color, 0.82)
    .setAngle(24)
    .setDepth(VFX_DEPTH + 1)
    .setScale(0.35, 1);

  const foam = scene.add
    .rectangle(x, y, 210, 6, 0xe0f2fe, 1)
    .setAngle(24)
    .setDepth(VFX_DEPTH + 2)
    .setScale(0.35, 1);

  scene.tweens.add({
    targets: [slash, foam],
    scaleX: 1.35,
    scaleY: 0.2,
    alpha: 0,
    duration: 260,
    ease: 'Cubic.Out',
    onComplete: () => {
      slash.destroy();
      foam.destroy();
    }
  });
}

/**
 * Ichigo — Getsuga Tensho: towering dark-crimson & black crescent wave slicing
 * forward across the arena.
 */
export function spawnGetsugaTensho(scene: Phaser.Scene, x: number, y: number, facing: 1 | -1): void {
  const crescent = scene.add.graphics({ x, y }).setDepth(VFX_DEPTH + 1);
  const startAngle = facing === 1 ? -1.15 : Math.PI + 1.15;
  const endAngle = facing === 1 ? 1.15 : Math.PI - 1.15;
  const ccw = facing === -1;

  crescent.lineStyle(26, 0xdc2626, 0.72);
  crescent.beginPath();
  crescent.arc(0, 0, 88, startAngle, endAngle, ccw);
  crescent.strokePath();

  crescent.lineStyle(13, 0x090d16, 0.98);
  crescent.beginPath();
  crescent.arc(0, 0, 90, startAngle, endAngle, ccw);
  crescent.strokePath();

  crescent.lineStyle(5, 0xfca5a5, 0.95);
  crescent.beginPath();
  crescent.arc(0, 0, 96, startAngle, endAngle, ccw);
  crescent.strokePath();

  scene.tweens.add({
    targets: crescent,
    x: x + facing * 240,
    scaleX: 1.25,
    scaleY: 1.35,
    alpha: 0,
    duration: 340,
    ease: 'Cubic.Out',
    onComplete: () => crescent.destroy()
  });
}

/** Ichigo — Getsuga Tensho crimson-black cross slash on contact. */
export function spawnGetsugaTenshoImpact(scene: Phaser.Scene, x: number, y: number, blocked: boolean): void {
  const outer = blocked ? 0x7ec8ff : 0xdc2626;
  const coreColor = blocked ? 0xffffff : 0x090d16;
  const angle = -26;

  const aura = scene.add
    .rectangle(x, y, 225, blocked ? 12 : 22, outer, 0.85)
    .setAngle(angle)
    .setDepth(VFX_DEPTH + 1)
    .setScale(0.35, 1);

  const core = scene.add
    .rectangle(x, y, 230, 8, coreColor, 0.98)
    .setAngle(angle)
    .setDepth(VFX_DEPTH + 2)
    .setScale(0.35, 1);

  scene.tweens.add({
    targets: [aura, core],
    scaleX: 1.35,
    scaleY: 0.2,
    alpha: 0,
    duration: 280,
    ease: 'Cubic.Out',
    onComplete: () => {
      aura.destroy();
      core.destroy();
    }
  });
}


