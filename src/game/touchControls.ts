import * as Phaser from 'phaser';

import type { AppContext } from './context';
import { NEUTRAL_FIGHTER_INPUT, type FighterInput } from './fighter';
import {
  computeTouchButtonLayout,
  isTouchCapableDevice,
  resolveTouchFighterInput,
  type TouchButtonId,
  type TouchButtonSpec
} from './touchLayout';

export { computeTouchButtonLayout, isTouchCapableDevice, resolveTouchFighterInput };
export type { TouchButtonId, TouchButtonSpec };

interface ButtonVisual {
  spec: TouchButtonSpec;
  container: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
  labelText?: Phaser.GameObjects.Text;
  wasPressed: boolean;
  wasEnabled: boolean;
}

const TOUCH_DEPTH = 110;

/**
 * On-screen arcade touch controls anchored in the bottom-left (movement
 * arrows) and bottom-right (Attack, Kick, Special, Block) corners for mobile
 * and iPad/tablet players, or whenever the debug Touch Controls toggle is on.
 */
export class MatchTouchControls {
  private readonly scene: Phaser.Scene;
  private readonly app: AppContext;
  private readonly root: Phaser.GameObjects.Container;
  private readonly buttons: ButtonVisual[] = [];
  private readonly previousPressed = new Set<TouchButtonId>();
  private readonly unsubscribeDebug: () => void;

  private autoTouchDetected = false;
  private matchActive = true;
  private visible = false;

  constructor(scene: Phaser.Scene, app: AppContext) {
    this.scene = scene;
    this.app = app;
    this.root = scene.add.container(0, 0).setDepth(TOUCH_DEPTH).setScrollFactor(0);

    const { width, height } = scene.cameras.main;
    const specs = computeTouchButtonLayout(width, height);
    specs.forEach((spec) => {
      this.buttons.push(this.createButtonVisual(spec));
    });

    this.autoTouchDetected = isTouchCapableDevice();
    this.syncVisibility();

    this.unsubscribeDebug = app.debugStore.subscribe(() => {
      this.syncVisibility();
    });
  }

  get isVisible(): boolean {
    return this.visible;
  }

  /** Reveals the touch buttons immediately when a real touch event occurs. */
  enableAutoTouch(): void {
    if (!this.autoTouchDetected) {
      this.autoTouchDetected = true;
      this.syncVisibility();
    }
  }

  /** Shows or hides the overlay for match-over menus without losing state. */
  setMatchActive(active: boolean): void {
    this.matchActive = active;
    if (!active) {
      this.previousPressed.clear();
    }
    this.syncVisibility();
  }

  /**
   * Scans all active Phaser pointers each frame (supporting multi-touch across
   * D-pad + action buttons) and returns the resulting {@link FighterInput}.
   */
  update(fighting: boolean, specialReady: boolean): FighterInput {
    this.syncVisibility();

    if (!this.visible || !fighting) {
      this.previousPressed.clear();
      this.updateVisuals(this.previousPressed, specialReady);
      return { ...NEUTRAL_FIGHTER_INPUT };
    }

    const pressed = new Set<TouchButtonId>();
    const pointers = this.scene.input.manager?.pointers ?? [];

    for (const pointer of pointers) {
      if (!pointer.isDown) {
        continue;
      }

      const hit = this.findButtonAt(pointer.x, pointer.y);
      if (hit) {
        pressed.add(hit);
      }
    }

    const activePointer = this.scene.input.activePointer;
    if (activePointer?.isDown) {
      const hit = this.findButtonAt(activePointer.x, activePointer.y);
      if (hit) {
        pressed.add(hit);
      }
    }

    const input = resolveTouchFighterInput(pressed, this.previousPressed);
    this.previousPressed.clear();
    pressed.forEach((id) => this.previousPressed.add(id));

    this.updateVisuals(pressed, specialReady);
    return input;
  }

  destroy(): void {
    this.unsubscribeDebug();
    this.root.destroy(true);
  }

  private syncVisibility(): void {
    const enabled =
      this.app.isMobileShell ||
      this.app.debugStore.getState().showTouchControls ||
      this.autoTouchDetected;

    this.visible = enabled && this.matchActive;
    this.root.setVisible(this.visible);
  }

  private findButtonAt(x: number, y: number): TouchButtonId | null {
    let closestId: TouchButtonId | null = null;
    let closestDistSq = Infinity;

    for (const button of this.buttons) {
      const dx = x - button.spec.x;
      const dy = y - button.spec.y;
      const distSq = dx * dx + dy * dy;
      const maxSq = button.spec.hitRadius * button.spec.hitRadius;

      if (distSq <= maxSq && distSq < closestDistSq) {
        closestDistSq = distSq;
        closestId = button.spec.id;
      }
    }

    return closestId;
  }

  private createButtonVisual(spec: TouchButtonSpec): ButtonVisual {
    const container = this.scene.add.container(spec.x, spec.y);
    const ring = this.scene.add.graphics();
    container.add(ring);

    let labelText: Phaser.GameObjects.Text | undefined;
    if (spec.label) {
      const fontSize = spec.id === 'special' ? '12px' : spec.id === 'block' ? '13px' : '15px';
      labelText = this.scene.add
        .text(0, 0, spec.label, {
          color: '#f8fafc',
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fontSize,
          stroke: '#020617',
          strokeThickness: 3
        })
        .setOrigin(0.5);
      container.add(labelText);
    }

    this.root.add(container);

    const visual: ButtonVisual = {
      spec,
      container,
      ring,
      labelText,
      wasPressed: false,
      wasEnabled: true
    };
    this.redrawButton(visual, false, spec.id !== 'special');
    return visual;
  }

  private updateVisuals(pressed: ReadonlySet<TouchButtonId>, specialReady: boolean): void {
    for (const button of this.buttons) {
      const isPressed = pressed.has(button.spec.id);
      const isEnabled = button.spec.id !== 'special' || specialReady;

      if (isPressed !== button.wasPressed || isEnabled !== button.wasEnabled) {
        button.wasPressed = isPressed;
        button.wasEnabled = isEnabled;
        this.redrawButton(button, isPressed, isEnabled);
        button.container.setScale(isPressed ? 0.92 : 1);
      }
    }
  }

  private redrawButton(button: ButtonVisual, pressed: boolean, enabled: boolean): void {
    const { ring, spec, labelText } = button;
    const fillAlpha = !enabled ? 0.28 : pressed ? 0.78 : 0.54;
    const strokeAlpha = !enabled ? 0.35 : pressed ? 1 : 0.85;
    const fillColor = pressed ? spec.accentColor : 0x0b1222;
    const strokeWidth = pressed || (spec.id === 'special' && enabled) ? 3.5 : 2.5;

    ring.clear();
    ring.fillStyle(fillColor, fillAlpha);
    ring.fillCircle(0, 0, spec.radius);
    ring.lineStyle(strokeWidth, spec.accentColor, strokeAlpha);
    ring.strokeCircle(0, 0, spec.radius);

    if (spec.id === 'special' && enabled && !pressed) {
      ring.lineStyle(2, 0xfef08a, 0.75);
      ring.strokeCircle(0, 0, spec.radius - 5);
    }

    if (spec.arrow) {
      this.drawArrowGlyph(ring, spec.arrow, spec.radius * 0.42, pressed ? 0x020617 : 0xf8fafc);
    }

    if (labelText) {
      labelText.setAlpha(enabled ? 1 : 0.45);
      labelText.setColor(pressed ? '#020617' : spec.id === 'special' && enabled ? '#fef08a' : '#f8fafc');
    }
  }

  private drawArrowGlyph(
    graphics: Phaser.GameObjects.Graphics,
    dir: 'left' | 'right' | 'up',
    size: number,
    color: number
  ): void {
    graphics.fillStyle(color, 0.95);
    graphics.beginPath();

    if (dir === 'left') {
      graphics.moveTo(-size, 0);
      graphics.lineTo(size * 0.65, -size * 0.82);
      graphics.lineTo(size * 0.65, size * 0.82);
    } else if (dir === 'right') {
      graphics.moveTo(size, 0);
      graphics.lineTo(-size * 0.65, -size * 0.82);
      graphics.lineTo(-size * 0.65, size * 0.82);
    } else {
      graphics.moveTo(0, -size);
      graphics.lineTo(size * 0.82, size * 0.65);
      graphics.lineTo(-size * 0.82, size * 0.65);
    }

    graphics.closePath();
    graphics.fillPath();
  }
}
