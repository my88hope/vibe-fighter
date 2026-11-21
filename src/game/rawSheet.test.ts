import { describe, expect, it } from 'vitest';

import { removeBackground } from './rawSheet';

function makeGrid(width: number, height: number, bg: [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    data[offset] = bg[0];
    data[offset + 1] = bg[1];
    data[offset + 2] = bg[2];
    data[offset + 3] = 255;
  }

  return data;
}

function setPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255
): void {
  const offset = (y * width + x) * 4;
  data[offset] = r;
  data[offset + 1] = g;
  data[offset + 2] = b;
  data[offset + 3] = a;
}

describe('removeBackground', () => {
  it('zeros RGB on removed green-screen pixels and strips exterior green fringe while keeping interior green details', () => {
    const width = 12;
    const height = 12;
    const data = makeGrid(width, height, [18, 242, 10]);

    // 7x7 dark outline box from (2,2)..(8,8) with interior teal-green hair at (4..6, 4..6)
    for (let y = 2; y <= 8; y += 1) {
      for (let x = 2; x <= 8; x += 1) {
        if (x === 2 || x === 8 || y === 2 || y === 8) {
          setPixel(data, width, x, y, 8, 8, 10);
        } else {
          setPixel(data, width, x, y, 37, 77, 50);
        }
      }
    }

    // Add 1px opaque green-screen halo outside the outline at (1, 5) and (9, 5)
    setPixel(data, width, 1, 5, 0, 100, 0);
    setPixel(data, width, 9, 5, 15, 99, 3);
    // Add anti-aliased bright edge pixel with green spill at (2, 5)
    setPixel(data, width, 2, 5, 90, 180, 95);

    removeBackground(data, width, height);

    // Flat background is fully cleared with zeroed RGB
    expect(Array.from(data.slice(0, 4))).toEqual([0, 0, 0, 0]);

    // Exterior opaque green halo pixels are cleared to transparent black
    const leftHalo = (5 * width + 1) * 4;
    const rightHalo = (5 * width + 9) * 4;
    expect(Array.from(data.slice(leftHalo, leftHalo + 4))).toEqual([0, 0, 0, 0]);
    expect(Array.from(data.slice(rightHalo, rightHalo + 4))).toEqual([0, 0, 0, 0]);

    // Boundary anti-aliased pixel has green spill clamped cleanly
    const edge = (5 * width + 2) * 4;
    expect(data[edge + 3]).toBeGreaterThan(0);
    expect(data[edge + 1]).toBeLessThanOrEqual(Math.max(data[edge], data[edge + 2]));

    // Interior teal-green detail stays intact
    const interior = (5 * width + 5) * 4;
    expect(Array.from(data.slice(interior, interior + 4))).toEqual([37, 77, 50, 255]);
  });
});
