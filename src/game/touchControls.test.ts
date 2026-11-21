import { describe, expect, it } from 'vitest';

import {
  computeTouchButtonLayout,
  resolveTouchFighterInput,
  type TouchButtonId
} from './touchLayout';

describe('touchControls', () => {
  it('lays out non-overlapping corner movement arrows and combat buttons in landscape and portrait', () => {
    for (const [width, height] of [
      [1280, 720],
      [720, 1280]
    ]) {
      const buttons = computeTouchButtonLayout(width, height);
      const ids = buttons.map((button) => button.id);

      expect(ids).toEqual(['left', 'right', 'jump', 'light', 'heavy', 'special', 'block']);

      // All buttons stay cleanly inside viewport bounds
      for (const button of buttons) {
        expect(button.x - button.radius).toBeGreaterThanOrEqual(0);
        expect(button.x + button.radius).toBeLessThanOrEqual(width);
        expect(button.y - button.radius).toBeGreaterThanOrEqual(height * 0.55);
        expect(button.y + button.radius).toBeLessThanOrEqual(height);
      }

      // Movement arrows stay on the left, combat buttons stay on the right
      const arrows = buttons.filter((b) => b.arrow !== undefined);
      const actions = buttons.filter((b) => b.arrow === undefined);
      for (const arrow of arrows) {
        expect(arrow.x).toBeLessThan(width * 0.4);
      }
      for (const action of actions) {
        expect(action.x).toBeGreaterThan(width * 0.6);
      }

      // No two button visuals overlap each other
      for (let i = 0; i < buttons.length; i += 1) {
        for (let j = i + 1; j < buttons.length; j += 1) {
          const a = buttons[i];
          const b = buttons[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          expect(dist).toBeGreaterThan(a.radius + b.radius);
        }
      }
    }
  });

  it('keeps movement/block continuous and edge-triggers jump, attack, kick, and special', () => {
    const empty = new Set<TouchButtonId>();
    const frame1 = new Set<TouchButtonId>(['right', 'light', 'special']);
    const frame2 = new Set<TouchButtonId>(['right', 'light', 'special', 'heavy', 'jump', 'block']);

    expect(resolveTouchFighterInput(frame1, empty)).toEqual({
      left: false,
      right: true,
      crouch: false,
      block: false,
      jump: false,
      light: true,
      heavy: false,
      special: true
    });

    expect(resolveTouchFighterInput(frame2, frame1)).toEqual({
      left: false,
      right: true,
      crouch: false,
      block: true,
      jump: true,
      light: false,
      heavy: true,
      special: false
    });
  });
});
