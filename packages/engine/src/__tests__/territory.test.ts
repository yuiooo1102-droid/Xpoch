import { describe, it, expect } from "vitest";
import {
  expandTerritory,
  validateConnectivity,
  updateTerritoryCounts,
  transferTerritory,
} from "../territory";
import {
  createInitialState,
  setTile,
  addArmy,
  addCity,
  getFactionCities,
  updateFaction,
} from "../game-state";
import type { FactionConfig } from "../game-state";
import type { GameState } from "@xpoch/shared";
import { hexKey, hexNeighbors } from "@xpoch/shared";

const ONE_FACTION: readonly FactionConfig[] = [
  { id: "f1", name: "Alpha", modelProvider: "mock", color: "#ff0000" },
];

const TWO_FACTIONS: readonly FactionConfig[] = [
  { id: "f1", name: "Alpha", modelProvider: "mock", color: "#ff0000" },
  { id: "f2", name: "Beta", modelProvider: "mock", color: "#00ff00" },
];

function findNeutralTileAdjacentToFaction(
  state: GameState,
  factionId: string,
): { q: number; r: number } | null {
  for (const [, tile] of state.tiles) {
    if (tile.owner === factionId) {
      const neighbors = hexNeighbors(tile.coord);
      for (const nb of neighbors) {
        const nbTile = state.tiles.get(hexKey(nb));
        if (nbTile && nbTile.owner === null) {
          return nb;
        }
      }
    }
  }
  return null;
}

describe("expandTerritory", () => {
  it("claims neutral tile when idle army is on it adjacent to faction territory", () => {
    const state = createInitialState(5, 42, ONE_FACTION);

    // Find a neutral tile adjacent to f1 territory
    const target = findNeutralTileAdjacentToFaction(state, "f1");
    expect(target).not.toBeNull();

    // Place an idle army there
    const stateWithArmy = addArmy(state, {
      id: "expand-army",
      factionId: "f1",
      generalId: "lubu",
      troops: { infantry: 100, cavalry: 0, archer: 0 },
      coord: target!,
      target: null,
      state: "idle",
    });

    const result = expandTerritory(stateWithArmy);
    const tile = result.tiles.get(hexKey(target!));
    expect(tile?.owner).toBe("f1");
  });

  it("does not claim tile when army is marching", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const target = findNeutralTileAdjacentToFaction(state, "f1");
    expect(target).not.toBeNull();

    const stateWithArmy = addArmy(state, {
      id: "march-army",
      factionId: "f1",
      generalId: "lubu",
      troops: { infantry: 100, cavalry: 0, archer: 0 },
      coord: target!,
      target: { q: 0, r: 0 },
      state: "marching",
    });

    const result = expandTerritory(stateWithArmy);
    const tile = result.tiles.get(hexKey(target!));
    expect(tile?.owner).toBeNull();
  });

  it("does not claim tile that is not adjacent to faction territory", () => {
    const state = createInitialState(5, 42, ONE_FACTION);

    // Find a tile far from any owned territory
    const farCoord = { q: -5, r: -5 };
    const farTile = state.tiles.get(hexKey(farCoord));
    if (!farTile || farTile.owner !== null) return; // skip if not available

    const stateWithArmy = addArmy(state, {
      id: "far-army",
      factionId: "f1",
      generalId: "lubu",
      troops: { infantry: 100, cavalry: 0, archer: 0 },
      coord: farCoord,
      target: null,
      state: "idle",
    });

    const result = expandTerritory(stateWithArmy);
    const tile = result.tiles.get(hexKey(farCoord));
    expect(tile?.owner).toBeNull();
  });

  it("does not claim tile that is already owned", () => {
    const state = createInitialState(5, 42, ONE_FACTION);

    // Place army on a tile already owned by f1
    const ownedTile = [...state.tiles.values()].find((t) => t.owner === "f1");
    expect(ownedTile).toBeDefined();

    const stateWithArmy = addArmy(state, {
      id: "own-army",
      factionId: "f1",
      generalId: "lubu",
      troops: { infantry: 100, cavalry: 0, archer: 0 },
      coord: ownedTile!.coord,
      target: null,
      state: "idle",
    });

    const result = expandTerritory(stateWithArmy);
    const tile = result.tiles.get(hexKey(ownedTile!.coord));
    expect(tile?.owner).toBe("f1");
  });
});

describe("validateConnectivity", () => {
  it("disconnected tiles become neutral", () => {
    let state = createInitialState(5, 42, ONE_FACTION);

    // Find a tile far from the city and forcibly set it as owned by f1
    const farCoord = { q: -4, r: -4 };
    const farTile = state.tiles.get(hexKey(farCoord));
    if (!farTile) return;

    state = setTile(state, farCoord, { owner: "f1" });
    expect(state.tiles.get(hexKey(farCoord))?.owner).toBe("f1");

    const result = validateConnectivity(state);
    const tile = result.tiles.get(hexKey(farCoord));
    expect(tile?.owner).toBeNull();
  });

  it("connected tiles remain owned", () => {
    const state = createInitialState(5, 42, ONE_FACTION);

    // All initially owned tiles should stay owned after validation
    const result = validateConnectivity(state);

    for (const [key, tile] of state.tiles) {
      if (tile.owner === "f1") {
        const resultTile = result.tiles.get(key);
        expect(resultTile?.owner).toBe("f1");
      }
    }
  });
});

describe("updateTerritoryCounts", () => {
  it("correctly counts owned tiles per faction", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);
    const result = updateTerritoryCounts(state);

    for (const faction of result.factions.values()) {
      let count = 0;
      for (const tile of result.tiles.values()) {
        if (tile.owner === faction.id) count++;
      }
      expect(faction.territoryCount).toBe(count);
    }
  });

  it("returns 0 for faction with no territory", () => {
    let state = createInitialState(5, 42, ONE_FACTION);
    // Remove all f1 ownership
    for (const [, tile] of state.tiles) {
      if (tile.owner === "f1") {
        state = setTile(state, tile.coord, { owner: null });
      }
    }
    const result = updateTerritoryCounts(state);
    expect(result.factions.get("f1")?.territoryCount).toBe(0);
  });
});

describe("transferTerritory", () => {
  it("transfers city to new owner", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);
    const f1City = getFactionCities(state, "f1")[0];

    const result = transferTerritory(state, f1City.id, "f2");
    const city = result.cities.get(f1City.id);
    expect(city?.factionId).toBe("f2");
    expect(city?.isCapital).toBe(false);
  });

  it("transfers city tile ownership", () => {
    const state = createInitialState(5, 42, TWO_FACTIONS);
    const f1City = getFactionCities(state, "f1")[0];

    const result = transferTerritory(state, f1City.id, "f2");
    const tile = result.tiles.get(hexKey(f1City.coord));
    expect(tile?.owner).toBe("f2");
  });

  it("disconnected tiles of loser become neutral after city capture", () => {
    // Create state with two factions, capture f1's only city
    const state = createInitialState(5, 42, TWO_FACTIONS);
    const f1City = getFactionCities(state, "f1")[0];

    const result = transferTerritory(state, f1City.id, "f2");

    // f1 has no more cities, so all f1 tiles should be neutral
    for (const tile of result.tiles.values()) {
      expect(tile.owner).not.toBe("f1");
    }
  });

  it("returns same state for non-existent city", () => {
    const state = createInitialState(5, 42, ONE_FACTION);
    const result = transferTerritory(state, "nonexistent", "f2");
    expect(result).toBe(state);
  });
});
