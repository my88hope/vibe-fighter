import * as Phaser from 'phaser';

import { ensureFightersReady } from '../game/assets';
import { playAttackHitSfx } from '../game/combatSfx';
import { Fighter, NEUTRAL_FIGHTER_INPUT, type FighterInput } from '../game/fighter';
import { getCharacterDefinition } from '../game/hero';
import { MatchHud } from '../game/matchHud';
import { getStageDefinition } from '../game/stageConfig';
import { playSuperCutIn } from '../game/superCutIn';
import { MatchTouchControls } from '../game/touchControls';
import { SCENE_KEYS, type AttackKind, type MatchConfig } from '../game/types';
import {
  SPECIAL_ACCENT_COLOR,
  spawnGetsugaTensho,
  spawnGetsugaTenshoImpact,
  spawnHitSpark,
  spawnHollowPurple,
  spawnHollowPurpleImpact,
  spawnKamehameha,
  spawnKamehamehaImpact,
  spawnKatanaSlice,
  spawnKatanaSwing,
  spawnRasengan,
  spawnRasenganImpact,
  spawnRedHawk,
  spawnRedHawkImpact,
  spawnWaterSlash,
  spawnWaterSlashImpact,
  type VfxColor
} from '../game/vfx';
import { BaseScene } from './BaseScene';

const GROUND_FRACTION = 0.82;
const EDGE_MARGIN = 170;
const DEPTH_FRONT = 8;
const DEPTH_BACK = 5;

// Fraction of the gap from the screen centre each fighter occupies at spawn.
const SPAWN_OFFSET_FRACTION = 0.18;
// How quickly the camera eases toward the fighters' midpoint (0..1 per frame).
const CAMERA_LERP = 0.14;

const ROUNDS_TO_WIN = 2;
// Seconds on the round clock. When it expires the fighter with more health wins
// (a tie is a draw and replays the round).
const ROUND_SECONDS = 60;
const HUD_DEPTH = 100;
const BANNER_DEPTH = 200;
const OVERLAY_DEPTH = 300;

/** The match's high-level state, driving input gating and the HUD. */
type MatchPhase = 'intro' | 'fighting' | 'roundEnd' | 'matchOver';

interface PlayerKeys {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  crouch: Phaser.Input.Keyboard.Key;
  block: Phaser.Input.Keyboard.Key;
  jump: Phaser.Input.Keyboard.Key;
  light: Phaser.Input.Keyboard.Key;
  heavy: Phaser.Input.Keyboard.Key;
  special: Phaser.Input.Keyboard.Key;
}

/**
 * The versus match: two fighters spawn facing each other and fight a best-of-3
 * (first to {@link ROUNDS_TO_WIN} rounds). Each round runs a "ROUND n / FIGHT!"
 * intro, then live combat — attack boxes vs hurtboxes drive damage, hitstun,
 * knockback, and a knockdown on KO. When the match is decided a game-over
 * overlay offers a rematch or a return to the main menu. P1 is always human;
 * P2 is human in 1v1 or a simple CPU in 1vCPU.
 */
export class MatchScene extends BaseScene {
  private config: MatchConfig = {
    mode: '1v1',
    stageId: 'rooftop-twilight',
    p1CharacterId: '',
    p2CharacterId: ''
  };

  private p1!: Fighter;
  private p2!: Fighter;
  private p1Keys!: PlayerKeys;
  private p2Keys!: PlayerKeys;
  private cpu?: CpuController;

  private phase: MatchPhase = 'intro';
  private roundNumber = 1;
  private p1Wins = 0;
  private p2Wins = 0;

  private spawnX1 = 0;
  private spawnX2 = 0;
  private edgeMargin = EDGE_MARGIN;

  private stageWorldWidth = 0;
  private maxScroll = 0;

  private hud!: MatchHud;
  private banner!: Phaser.GameObjects.Text;
  private controlsLegend?: Phaser.GameObjects.Text;
  private touchControls!: MatchTouchControls;
  private roundTimeMs = ROUND_SECONDS * 1000;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private matchReady = false;
  private sceneDestroyed = false;

  constructor() {
    super(SCENE_KEYS.Match);
  }

  init(data: MatchConfig): void {
    if (data) {
      this.config = data;
    }
  }

  create(): void {
    this.cpu = undefined;
    this.phase = 'intro';
    this.roundNumber = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.overlay = [];
    this.matchReady = false;
    this.sceneDestroyed = false;

    this.markActiveScene(SCENE_KEYS.Match);
    this.cameras.main.setBackgroundColor(0x05070d);
    this.edgeMargin = Math.min(EDGE_MARGIN, Math.round(this.cameras.main.width * 0.14));

    this.buildStage();

    const loadingObjects = this.createMatchLoadingOverlay();
    const p1Id = this.config.p1CharacterId;
    const p2Id = this.config.p2CharacterId;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sceneDestroyed = true;
      loadingObjects.destroy();
    });

    void ensureFightersReady(this, [p1Id, p2Id], (fraction, label) => {
      if (!this.sceneDestroyed) {
        loadingObjects.update(fraction, label);
      }
    })
      .catch((error) => console.error('[match] failed to prepare fighters', error))
      .then(() => {
        loadingObjects.destroy();
        if (this.sceneDestroyed) {
          return;
        }
        this.finishMatchSetup();
      });
  }

  private finishMatchSetup(): void {
    this.spawnFighters();
    this.registerKeys();
    this.touchControls = new MatchTouchControls(this, this.app);
    this.createControlsLegend();

    const handleTouchDetect = (pointer: Phaser.Input.Pointer): void => {
      const pointerType = (pointer.event as PointerEvent | undefined)?.pointerType;
      if (pointer.wasTouch || pointerType === 'touch') {
        this.touchControls.enableAutoTouch();
        this.syncControlsLegendVisibility();
      }
    };
    this.input.on('pointerdown', handleTouchDetect);

    const unsubscribeTouchDebug = this.app.debugStore.subscribe(() => {
      this.syncControlsLegendVisibility();
    });

    this.hud = new MatchHud(this, {
      mode: this.config.mode,
      p1CharacterId: this.config.p1CharacterId,
      p2CharacterId: this.config.p2CharacterId,
      roundsToWin: ROUNDS_TO_WIN,
      depth: HUD_DEPTH
    });
    this.hud.slideIn();

    const isNarrow = this.cameras.main.width < 900;
    this.banner = this.add
      .text(this.cameras.main.centerX, this.cameras.main.centerY - 40, '', {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: isNarrow ? '48px' : '64px',
        stroke: '#020617',
        strokeThickness: 8,
        align: 'center',
        wordWrap: { width: this.cameras.main.width - 48 }
      })
      .setOrigin(0.5)
      .setDepth(BANNER_DEPTH)
      .setScrollFactor(0)
      .setAlpha(0);

    if (this.config.mode === '1vcpu') {
      this.cpu = new CpuController();
    }

    this.matchReady = true;
    this.startRound();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', handleTouchDetect);
      unsubscribeTouchDebug();
      this.touchControls?.destroy();
      this.p1?.destroy();
      this.p2?.destroy();
      this.hud?.destroy();
    });
  }

  private createMatchLoadingOverlay(): {
    update: (fraction: number, label: string) => void;
    destroy: () => void;
  } {
    const { centerX, centerY, width, height } = this.cameras.main;
    const barWidth = Math.min(440, width - 80);
    const barHeight = 20;
    const p1Label = getCharacterDefinition(this.config.p1CharacterId).label.toUpperCase();
    const p2Label = getCharacterDefinition(this.config.p2CharacterId).label.toUpperCase();

    const backdrop = this.add
      .rectangle(centerX, centerY, width, height, 0x020617, 0.78)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH);
    const matchupText = this.add
      .text(centerX, centerY - 52, `${p1Label}  VS  ${p2Label}`, {
        color: '#facc15',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: width < 900 ? '24px' : '30px',
        stroke: '#020617',
        strokeThickness: 6,
        align: 'center',
        wordWrap: { width: width - 48 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH);
    const track = this.add
      .rectangle(centerX, centerY + 4, barWidth + 6, barHeight + 6, 0x0f172a, 0.95)
      .setStrokeStyle(2, 0x38bdf8, 0.9)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH);
    const fill = this.add
      .rectangle(centerX - barWidth / 2, centerY + 4, 4, barHeight, 0x38bdf8, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH);
    const status = this.add
      .text(centerX, centerY + 38, 'Loading fighters...', {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '14px'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH);

    const items: Phaser.GameObjects.GameObject[] = [backdrop, matchupText, track, fill, status];
    let destroyed = false;

    return {
      update: (fraction: number, label: string) => {
        if (destroyed) {
          return;
        }
        const clamped = Phaser.Math.Clamp(fraction, 0, 1);
        fill.width = Math.max(4, Math.round(barWidth * clamped));
        status.setText(`${label} (${Math.round(clamped * 100)}%)`);
      },
      destroy: () => {
        if (destroyed) {
          return;
        }
        destroyed = true;
        items.forEach((item) => item.destroy());
      }
    };
  }

  /**
   * Per-frame loop: feeds both fighters their input (only while fighting),
   * keeps them facing each other, resolves hits, checks for a KO, and redraws
   * the HUD.
   * @param time - Phaser clock time in ms.
   * @param delta - Milliseconds since the previous frame.
   */
  update(time: number, delta: number): void {
    if (!this.matchReady) {
      return;
    }

    const seconds = delta / 1000;
    const fighting = this.phase === 'fighting';

    const keyInput = fighting ? this.readKeys(this.p1Keys) : { ...NEUTRAL_FIGHTER_INPUT };
    const touchInput = this.touchControls.update(fighting, this.p1.isMeterReady);
    const p1Input: FighterInput = fighting
      ? {
          left: keyInput.left || touchInput.left,
          right: keyInput.right || touchInput.right,
          crouch: keyInput.crouch || touchInput.crouch,
          block: keyInput.block || touchInput.block,
          jump: keyInput.jump || touchInput.jump,
          light: keyInput.light || touchInput.light,
          heavy: keyInput.heavy || touchInput.heavy,
          special: keyInput.special || touchInput.special
        }
      : { ...NEUTRAL_FIGHTER_INPUT };
    const p2Input = fighting
      ? this.cpu
        ? this.cpu.update(time)
        : this.readKeys(this.p2Keys)
      : { ...NEUTRAL_FIGHTER_INPUT };

    // Crouching (and crouch-block) is disabled for now: defense is simply
    // block-or-not. The geometric guard-box model still resolves blocks via the
    // standing guard box; the crouch/low path stays in the code but unused.
    p1Input.crouch = false;
    p2Input.crouch = false;

    // CPU occasionally unleashes its special once the meter is charged.
    if (fighting && this.cpu && this.p2.isMeterReady && Phaser.Math.Between(0, 150) === 0) {
      p2Input.special = true;
    }

    this.p1.faceToward(this.p2.x);
    this.p2.faceToward(this.p1.x);

    if (fighting) {
      if (isActing(p1Input)) {
        this.p1.setDepthBase(DEPTH_FRONT);
        this.p2.setDepthBase(DEPTH_BACK);
      } else if (isActing(p2Input)) {
        this.p2.setDepthBase(DEPTH_FRONT);
        this.p1.setDepthBase(DEPTH_BACK);
      }
    }

    this.p1.update(seconds, p1Input);
    this.p2.update(seconds, p2Input);

    this.updateCamera(false);

    if (fighting) {
      this.resolveCombat();
      this.checkForKnockout();

      if (this.phase === 'fighting') {
        this.tickRoundTimer(delta);
        this.hud.applyHealth(this.p1.health01, this.p2.health01);
      }
    }

    this.hud.setMeter(this.p1.meter01, this.p2.meter01);
    this.hud.setTime(Math.ceil(this.roundTimeMs / 1000));
    this.hud.updateWins(this.p1Wins, this.p2Wins);
  }

  /**
   * Checks both directions for a connecting hit and applies damage/block this
   * frame. A swing only lands once thanks to the attacker's connect flag.
   */
  private resolveCombat(): void {
    this.tryHit(this.p1, this.p2);
    this.tryHit(this.p2, this.p1);
  }

  /**
   * Resolves a single attacker -> defender interaction for the current frame.
   * Blocking is purely geometric: the hit is guarded when the attack box
   * overlaps the defender's active guard box (from its block pose).
   * @param attacker - The fighter whose attack box is tested.
   * @param defender - The fighter whose hurtbox is tested.
   */
  private tryHit(attacker: Fighter, defender: Fighter): void {
    if (defender.isDefeated) {
      return;
    }

    const attack = attacker.getActiveAttack();
    if (!attack) {
      return;
    }

    const hurt = defender.getHurtRect();
    if (!hurt || !Phaser.Geom.Intersects.RectangleToRectangle(attack.rect, hurt)) {
      return;
    }

    const guard = defender.getGuardRect();
    const blocked = guard !== null && Phaser.Geom.Intersects.RectangleToRectangle(attack.rect, guard);
    const isSpecial = attack.profile.kind === 'special';
    const finisher = attack.finisher && !blocked;

    // The combo finisher launches harder and stuns longer than a regular hit.
    const profile = finisher
      ? { ...attack.profile, knockback: attack.profile.knockback * 1.9, hitstun: attack.profile.hitstun * 1.4 }
      : attack.profile;

    defender.applyHit(profile, attacker.facingDirection, blocked);
    defender.flashHit(blocked);
    attacker.markAttackConnected();
    attacker.registerOffense(blocked, isSpecial);
    defender.registerDefense(blocked);

    this.spawnHitFx(attack.rect, hurt, blocked, attack.profile.kind, finisher, attacker);
  }

  /**
   * Spawns the impact spark and camera shake for a connecting hit, scaled up for
   * special hits and the combo finisher.
   * @param attackRect - The attacker's attack box (world space).
   * @param hurtRect - The defender's hurtbox (world space).
   * @param blocked - Whether the hit was guarded.
   * @param attackKind - Whether the strike was light (punch), heavy (kick), or special.
   * @param finisher - Whether this is the special's finishing hit.
   * @param attacker - The attacking fighter.
   */
  private spawnHitFx(
    attackRect: Phaser.Geom.Rectangle,
    hurtRect: Phaser.Geom.Rectangle,
    blocked: boolean,
    attackKind: AttackKind,
    finisher: boolean,
    attacker: Fighter
  ): void {
    const isSpecial = attackKind === 'special';
    const sparkX = (Phaser.Geom.Rectangle.GetCenter(attackRect).x + Phaser.Geom.Rectangle.GetCenter(hurtRect).x) / 2;
    const sparkY = (Phaser.Geom.Rectangle.GetCenter(attackRect).y + Phaser.Geom.Rectangle.GetCenter(hurtRect).y) / 2;

    const color: VfxColor = blocked ? 'blue' : finisher ? 'gold' : 'red';
    const sparkScale = finisher ? 1.7 : isSpecial ? 1.1 : 0.9;
    spawnHitSpark(this, sparkX, sparkY, color, sparkScale);
    playAttackHitSfx(this.app.settingsStore.getState(), attackKind, blocked, {
      characterId: attacker.characterId,
      finisher
    });

    if (isSpecial) {
      const hurtCenter = Phaser.Geom.Rectangle.GetCenter(hurtRect);
      switch (attacker.characterId) {
        case 'maki':
          spawnKatanaSlice(this, hurtCenter.x, hurtCenter.y, attacker.facingDirection, blocked);
          break;
        case 'gojo':
          spawnHollowPurpleImpact(this, hurtCenter.x, hurtCenter.y, blocked);
          break;
        case 'naruto':
          spawnRasenganImpact(this, hurtCenter.x, hurtCenter.y, blocked);
          break;
        case 'goku':
          spawnKamehamehaImpact(this, hurtCenter.x, hurtCenter.y, blocked);
          break;
        case 'luffy':
          spawnRedHawkImpact(this, hurtCenter.x, hurtCenter.y, blocked);
          break;
        case 'tanjiro':
          spawnWaterSlashImpact(this, hurtCenter.x, hurtCenter.y, blocked);
          break;
        case 'ichigo':
          spawnGetsugaTenshoImpact(this, hurtCenter.x, hurtCenter.y, blocked);
          break;
      }
    }

    if (finisher) {
      this.cameras.main.shake(220, 0.012);
    } else if (isSpecial) {
      this.cameras.main.shake(blocked ? 60 : 90, blocked ? 0.003 : 0.005);
    } else {
      this.cameras.main.shake(blocked ? 60 : 120, blocked ? 0.003 : 0.006);
    }
  }

  /** Ends the round when either fighter is knocked out. */
  private checkForKnockout(): void {
    if (this.p1.isDefeated) {
      this.endRound(2);
    } else if (this.p2.isDefeated) {
      this.endRound(1);
    }
  }

  /**
   * Counts the round clock down while fighting. When it reaches zero the round
   * is decided on remaining health (a tie replays the round as a draw).
   * @param delta - Milliseconds since the previous frame.
   */
  private tickRoundTimer(delta: number): void {
    this.roundTimeMs = Math.max(0, this.roundTimeMs - delta);

    if (this.roundTimeMs <= 0) {
      this.resolveTimeOut();
    }
  }

  /** Decides a timed-out round by comparing remaining health. */
  private resolveTimeOut(): void {
    const p1 = this.p1.health01;
    const p2 = this.p2.health01;

    if (p1 > p2) {
      this.endRound(1, 'TIME UP', '#facc15');
    } else if (p2 > p1) {
      this.endRound(2, 'TIME UP', '#facc15');
    } else {
      this.drawRound();
    }
  }

  /** Handles a drawn round (timeout with equal health): replays the round. */
  private drawRound(): void {
    if (this.phase !== 'fighting') {
      return;
    }

    this.phase = 'roundEnd';
    this.showBanner('DRAW', '#e2e8f0', 1.1);
    this.time.delayedCall(1100, () => this.startRound());
  }

  /**
   * Places the chosen stage fit to the viewport height, anchored at world x=0,
   * and sets up the scrollable world. The stage's on-screen width becomes the
   * world width; the camera is bounded to it so it can scroll horizontally and
   * stop at the stage ends (producing corners).
   */
  private buildStage(): void {
    const cam = this.cameras.main;
    const stage = getStageDefinition(this.config.stageId);
    const source = this.textures.get(stage.key).getSourceImage();
    const scale = cam.height / (source.height || stage.height);
    this.stageWorldWidth = (source.width || stage.width) * scale;
    this.maxScroll = Math.max(0, this.stageWorldWidth - cam.width);

    this.add.image(0, 0, stage.key).setOrigin(0, 0).setScale(scale).setDepth(0);
    cam.setBounds(0, 0, this.stageWorldWidth, cam.height);
  }

  /** Spawns P1 (left, facing right) and P2 (right, facing left). */
  private spawnFighters(): void {
    const cam = this.cameras.main;
    const groundY = Math.round(cam.height * GROUND_FRACTION);
    const minX = this.edgeMargin;
    const maxX = this.stageWorldWidth - this.edgeMargin;
    const center = this.stageWorldWidth / 2;
    const spawnOffsetFraction = cam.width < 900 ? 0.24 : SPAWN_OFFSET_FRACTION;
    this.spawnX1 = Math.round(center - cam.width * spawnOffsetFraction);
    this.spawnX2 = Math.round(center + cam.width * spawnOffsetFraction);

    this.p1 = new Fighter({
      scene: this,
      app: this.app,
      characterId: this.config.p1CharacterId,
      x: this.spawnX1,
      groundY,
      facing: 1,
      minX,
      maxX,
      depth: DEPTH_FRONT,
      onSpecialStart: (fighter) =>
        playSuperCutIn(this, {
          characterId: fighter.characterId,
          side: 'left',
          accentHex: SPECIAL_ACCENT_COLOR[fighter.characterId]
        }),
      onSpecialExecute: (fighter) => this.triggerSpecialExecuteFx(fighter, groundY)
    });

    this.p2 = new Fighter({
      scene: this,
      app: this.app,
      characterId: this.config.p2CharacterId,
      x: this.spawnX2,
      groundY,
      facing: -1,
      minX,
      maxX,
      depth: DEPTH_BACK,
      onSpecialStart: (fighter) =>
        playSuperCutIn(this, {
          characterId: fighter.characterId,
          side: 'right',
          accentHex: SPECIAL_ACCENT_COLOR[fighter.characterId]
        }),
      onSpecialExecute: (fighter) => this.triggerSpecialExecuteFx(fighter, groundY)
    });
  }

  private triggerSpecialExecuteFx(fighter: Fighter, groundY: number): void {
    const facing = fighter.facingDirection;
    const midY = groundY - 135;
    const frontX = fighter.x + facing * 64;

    switch (fighter.characterId) {
      case 'maki':
        spawnKatanaSwing(this, fighter.x + facing * 68, midY, facing);
        break;
      case 'gojo':
        spawnHollowPurple(this, frontX, midY - 8, facing);
        break;
      case 'naruto':
        spawnRasengan(this, frontX, midY, facing);
        break;
      case 'goku':
        spawnKamehameha(this, frontX, midY - 6, facing);
        break;
      case 'luffy':
        spawnRedHawk(this, frontX, midY - 4, facing);
        break;
      case 'tanjiro':
        spawnWaterSlash(this, frontX, midY, facing);
        break;
      case 'ichigo':
        spawnGetsugaTensho(this, frontX, midY - 6, facing);
        break;
    }
  }

  /**
   * Group-camera tracking: scrolls horizontally to keep both fighters framed
   * around their midpoint, clamped to the stage ends (so it stops at corners),
   * then turns the visible screen edges into movement walls for both fighters.
   * This is what produces the "camera locks until one fighter relents" feel —
   * neither fighter can walk off-screen, so they can only separate as far as the
   * screen is wide.
   * @param snap - When true, jumps to the target scroll instantly (round start)
   *   instead of easing toward it.
   */
  private updateCamera(snap: boolean): void {
    const cam = this.cameras.main;
    const viewWidth = cam.width;
    const midpoint = (this.p1.x + this.p2.x) / 2;
    const targetScroll = Phaser.Math.Clamp(midpoint - viewWidth / 2, 0, this.maxScroll);
    const scrollX = snap ? targetScroll : Phaser.Math.Linear(cam.scrollX, targetScroll, CAMERA_LERP);

    cam.setScroll(scrollX, 0);

    const leftWall = scrollX + this.edgeMargin;
    const rightWall = scrollX + viewWidth - this.edgeMargin;
    this.p1.setHorizontalBounds(leftWall, rightWall);
    this.p2.setHorizontalBounds(leftWall, rightWall);
  }

  /** Registers the two keyboard control schemes plus the menu shortcut. */
  private registerKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('MatchScene requires keyboard input');
    }

    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.p1Keys = {
      left: keyboard.addKey(codes.A),
      right: keyboard.addKey(codes.D),
      crouch: keyboard.addKey(codes.S),
      block: keyboard.addKey(codes.C),
      jump: keyboard.addKey(codes.W),
      light: keyboard.addKey(codes.F),
      heavy: keyboard.addKey(codes.G),
      special: keyboard.addKey(codes.V)
    };

    this.p2Keys = {
      left: keyboard.addKey(codes.LEFT),
      right: keyboard.addKey(codes.RIGHT),
      crouch: keyboard.addKey(codes.DOWN),
      block: keyboard.addKey(codes.FORWARD_SLASH),
      jump: keyboard.addKey(codes.UP),
      light: keyboard.addKey(codes.COMMA),
      heavy: keyboard.addKey(codes.PERIOD),
      special: keyboard.addKey(codes.L)
    };

    keyboard.on('keydown-ESC', () => this.goToMenu());
    keyboard.on('keydown-BACKSPACE', () => this.goToMenu());
    keyboard.on('keydown-R', () => {
      if (this.phase === 'matchOver') {
        this.rematch();
      }
    });
  }

  /**
   * Reads a control scheme into a fighter input snapshot. Held keys map to held
   * inputs; jump/light/heavy use edge detection so they fire once per press.
   * @param keys - The player's resolved keys.
   */
  private readKeys(keys: PlayerKeys): FighterInput {
    return {
      left: keys.left.isDown,
      right: keys.right.isDown,
      crouch: keys.crouch.isDown,
      block: keys.block.isDown,
      jump: Phaser.Input.Keyboard.JustDown(keys.jump),
      light: Phaser.Input.Keyboard.JustDown(keys.light),
      heavy: Phaser.Input.Keyboard.JustDown(keys.heavy),
      special: Phaser.Input.Keyboard.JustDown(keys.special)
    };
  }

  /** Draws the control legend at the bottom of the screen. */
  private createControlsLegend(): void {
    const { centerX, width, height } = this.cameras.main;
    const isNarrow = width < 900;
    const p1 = 'P1: WASD • F light • G heavy • C block • V special';
    const p2 = this.config.mode === '1vcpu' ? 'P2: CPU' : 'P2: Arrows • , light • . heavy • / block • L special';
    const sep = isNarrow ? '\n' : '      ';

    this.controlsLegend = this.add
      .text(centerX, height - (isNarrow ? 30 : 22), `${p1}${sep}${p2}${sep}Esc Menu`, {
        color: '#cbd5f5',
        fontFamily: 'monospace',
        fontSize: isNarrow ? '11px' : '12px',
        backgroundColor: 'rgba(2, 6, 23, 0.6)',
        padding: { x: 10, y: 5 },
        align: 'center',
        wordWrap: { width: width - 32 }
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH)
      .setScrollFactor(0);

    this.syncControlsLegendVisibility();
  }

  private syncControlsLegendVisibility(): void {
    this.controlsLegend?.setVisible(!this.touchControls?.isVisible);
  }

  /** Resets both fighters to their corners and runs the round intro. */
  private startRound(): void {
    this.phase = 'intro';
    this.touchControls?.setMatchActive(true);
    this.syncControlsLegendVisibility();
    this.roundTimeMs = ROUND_SECONDS * 1000;

    const fullMin = this.edgeMargin;
    const fullMax = this.stageWorldWidth - this.edgeMargin;
    this.p1.setHorizontalBounds(fullMin, fullMax);
    this.p2.setHorizontalBounds(fullMin, fullMax);

    this.p1.resetForRound(this.spawnX1, 1);
    this.p2.resetForRound(this.spawnX2, -1);
    this.p1.setDepthBase(DEPTH_FRONT);
    this.p2.setDepthBase(DEPTH_BACK);
    this.updateCamera(true);
    this.hud.animateFill();
    this.hud.updateWins(this.p1Wins, this.p2Wins);

    this.showBanner(`ROUND ${this.roundNumber}`, '#f8fafc');

    this.time.delayedCall(900, () => {
      if (this.phase !== 'intro') {
        return;
      }

      this.showBanner('FIGHT!', '#facc15', 1.15);
      this.phase = 'fighting';
      this.p1.setFrozen(false);
      this.p2.setFrozen(false);

      this.time.delayedCall(650, () => this.hideBanner());
    });
  }

  /**
   * Concludes the current round, tallies the win, and either advances to the
   * next round or ends the match.
   * @param winner - Which player won (1 or 2).
   * @param bannerText - The banner to show (defaults to a knockout).
   * @param bannerColor - The banner colour.
   */
  private endRound(winner: 1 | 2, bannerText = 'K.O.', bannerColor = '#f43f5e'): void {
    if (this.phase !== 'fighting') {
      return;
    }

    this.phase = 'roundEnd';

    if (winner === 1) {
      this.p1Wins += 1;
    } else {
      this.p2Wins += 1;
    }

    const winnerName =
      winner === 1
        ? `P1 ${getCharacterDefinition(this.config.p1CharacterId).label}`
        : `${this.config.mode === '1vcpu' ? 'CPU' : 'P2'} ${getCharacterDefinition(this.config.p2CharacterId).label}`;
    this.showBanner(bannerText, bannerColor, 1.2);

    this.time.delayedCall(1100, () => {
      const matchOver = this.p1Wins >= ROUNDS_TO_WIN || this.p2Wins >= ROUNDS_TO_WIN;

      if (matchOver) {
        this.endMatch(winnerName);
      } else {
        this.roundNumber += 1;
        this.startRound();
      }
    });
  }

  /**
   * Shows the game-over overlay with the match winner and rematch / menu options.
   * @param winnerName - The display name of the match winner.
   */
  private endMatch(winnerName: string): void {
    this.phase = 'matchOver';
    this.touchControls?.setMatchActive(false);
    this.hideBanner();

    const { centerX, centerY, width, height } = this.cameras.main;
    const isNarrow = width < 900;

    const dim = this.add
      .rectangle(centerX, centerY, width, height, 0x020617, 0.62)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0);

    const title = this.add
      .text(centerX, centerY - 96, `${winnerName}  WINS!`, {
        color: '#facc15',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: isNarrow ? '34px' : '46px',
        stroke: '#020617',
        strokeThickness: 6,
        align: 'center',
        wordWrap: { width: width - 48 }
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0);

    const score = this.add
      .text(centerX, centerY - 26, `${this.p1Wins} - ${this.p2Wins}`, {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '28px'
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0);

    const rematch = this.makeOverlayButton(centerX, centerY + 42, 'Rematch  (R)', () => this.rematch());
    const menu = this.makeOverlayButton(centerX, centerY + 100, 'Main Menu  (Esc)', () => this.goToMenu());

    this.overlay = [dim, title, score, rematch, menu];
  }

  /**
   * Builds a clickable overlay button with hover feedback.
   * @param x - Centre x.
   * @param y - Centre y.
   * @param label - Button text.
   * @param onClick - Click handler.
   */
  private makeOverlayButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const button = this.add
      .text(x, y, label, {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '22px',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: { x: 18, y: 10 }
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    button.on('pointerover', () => button.setColor('#facc15'));
    button.on('pointerout', () => button.setColor('#e2e8f0'));
    button.on('pointerdown', onClick);

    return button;
  }

  /** Restarts the match from round 1 with the same configuration. */
  private rematch(): void {
    this.overlay.forEach((object) => object.destroy());
    this.overlay = [];
    this.roundNumber = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.cpu = this.config.mode === '1vcpu' ? new CpuController() : undefined;
    this.startRound();
  }

  /**
   * Shows the centre banner with a short pop-in tween.
   * @param text - The banner text.
   * @param color - The text colour.
   * @param peakScale - The scale to settle at (default 1).
   */
  private showBanner(text: string, color: string, peakScale = 1): void {
    this.banner.setText(text).setColor(color).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: this.banner, alpha: 1, scale: peakScale, duration: 260, ease: 'Back.Out' });
  }

  /** Fades the centre banner out. */
  private hideBanner(): void {
    this.tweens.add({ targets: this.banner, alpha: 0, duration: 300 });
  }
}

/**
 * Whether an input represents the fighter actively doing something (moving,
 * jumping, or attacking) this frame — used to decide who draws in front.
 * @param input - The fighter input snapshot to test.
 */
function isActing(input: FighterInput): boolean {
  return input.left || input.right || input.jump || input.light || input.heavy || input.special;
}

/**
 * A placeholder CPU opponent: mostly idle, occasionally performing a short
 * random action (a strike, a hop, or a brief walk/crouch/block). Produces a
 * {@link FighterInput} each frame for the second fighter in 1vCPU matches.
 */
class CpuController {
  private nextDecisionAt = 0;
  private holdUntil = 0;
  private moveDir = 0;
  private holdCrouch = false;
  private holdBlock = false;

  /**
   * Produce the CPU's input for this frame.
   * @param timeMs - The current Phaser clock time in ms.
   */
  update(timeMs: number): FighterInput {
    const input: FighterInput = { ...NEUTRAL_FIGHTER_INPUT };

    if (timeMs >= this.nextDecisionAt) {
      this.decide(timeMs, input);
      this.nextDecisionAt = timeMs + Phaser.Math.Between(700, 1700);
    }

    if (timeMs < this.holdUntil) {
      if (this.moveDir < 0) {
        input.left = true;
      } else if (this.moveDir > 0) {
        input.right = true;
      }
      input.crouch = input.crouch || this.holdCrouch;
      input.block = input.block || this.holdBlock;
    } else {
      this.moveDir = 0;
      this.holdCrouch = false;
      this.holdBlock = false;
    }

    return input;
  }

  /**
   * Choose the CPU's next behaviour, emitting one-shot strikes immediately and
   * scheduling held movement/guard for a short window.
   * @param timeMs - The current Phaser clock time in ms.
   * @param input - The input snapshot to mutate for one-shot edges.
   */
  private decide(timeMs: number, input: FighterInput): void {
    const roll = Math.random();

    if (roll < 0.32) {
      return;
    }
    if (roll < 0.5) {
      input.light = true;
      return;
    }
    if (roll < 0.63) {
      input.heavy = true;
      return;
    }
    if (roll < 0.72) {
      input.jump = true;
      return;
    }
    if (roll < 0.9) {
      this.moveDir = Math.random() < 0.5 ? -1 : 1;
      this.holdUntil = timeMs + Phaser.Math.Between(350, 800);
      return;
    }

    if (Math.random() < 0.5) {
      this.holdCrouch = true;
    } else {
      this.holdBlock = true;
    }
    this.holdUntil = timeMs + Phaser.Math.Between(350, 800);
  }
}
