import { describe, it, expect } from "vitest";
import { hexToPixel, pixelToHex } from "../lib/hex-to-pixel";

describe("hexToPixel", () => {
  it("converts origin hex to origin pixel", () => {
    const [x, y] = hexToPixel({ q: 0, r: 0 }, 30);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });

  it("converts q=1 to positive x", () => {
    const [x, _y] = hexToPixel({ q: 1, r: 0 }, 30);
    expect(x).toBeGreaterThan(0);
  });
});

describe("pixelToHex", () => {
  it("roundtrips origin", () => {
    const [x, y] = hexToPixel({ q: 0, r: 0 }, 30);
    const coord = pixelToHex(x, y, 30);
    expect(coord.q).toBe(0);
    expect(coord.r).toBe(0);
  });

  it("roundtrips arbitrary hex", () => {
    const original = { q: 3, r: -2 };
    const [x, y] = hexToPixel(original, 30);
    const coord = pixelToHex(x, y, 30);
    expect(coord.q).toBe(3);
    expect(coord.r).toBe(-2);
  });
});
