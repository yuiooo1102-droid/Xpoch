import { describe, it, expect } from "vitest";
import { hexKey, parseHexKey, hexNeighbors, hexDistance, hexRing } from "../hex-utils";

describe("hexKey", () => {
  it("serializes a hex coord to string", () => {
    expect(hexKey({ q: 3, r: -2 })).toBe("3,-2");
  });
});

describe("parseHexKey", () => {
  it("deserializes a string to hex coord", () => {
    expect(parseHexKey("3,-2")).toEqual({ q: 3, r: -2 });
  });
});

describe("hexNeighbors", () => {
  it("returns 6 neighbors for origin", () => {
    const neighbors = hexNeighbors({ q: 0, r: 0 });
    expect(neighbors).toHaveLength(6);
    expect(neighbors).toContainEqual({ q: 1, r: 0 });
    expect(neighbors).toContainEqual({ q: 0, r: 1 });
    expect(neighbors).toContainEqual({ q: -1, r: 1 });
  });
});

describe("hexDistance", () => {
  it("returns 0 for same coord", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
  });

  it("returns 1 for adjacent hexes", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
  });

  it("returns correct distance for distant hexes", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -2 })).toBe(3);
  });
});

describe("hexRing", () => {
  it("returns single hex for radius 0", () => {
    const ring = hexRing({ q: 0, r: 0 }, 0);
    expect(ring).toEqual([{ q: 0, r: 0 }]);
  });

  it("returns 6 hexes for radius 1", () => {
    const ring = hexRing({ q: 0, r: 0 }, 1);
    expect(ring).toHaveLength(6);
  });

  it("returns 12 hexes for radius 2", () => {
    const ring = hexRing({ q: 0, r: 0 }, 2);
    expect(ring).toHaveLength(12);
  });
});
