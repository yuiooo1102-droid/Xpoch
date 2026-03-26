import type {
  GameState,
  FactionId,
  CityId,
  Tile,
} from "@xpoch/shared";
import { hexKey, hexNeighbors, parseHexKey } from "@xpoch/shared";
import { setTile, updateFaction } from "./game-state";

/**
 * When an army is stationary on a neutral tile adjacent to faction territory,
 * claim that tile for the faction.
 */
export function expandTerritory(state: GameState): GameState {
  let result = state;

  for (const army of state.armies.values()) {
    if (army.state !== "idle") continue;

    const armyKey = hexKey(army.coord);
    const tile = result.tiles.get(armyKey);
    if (!tile) continue;

    // Tile must be neutral (no owner)
    if (tile.owner !== null) continue;

    // Check if any neighboring tile is owned by this army's faction
    const neighbors = hexNeighbors(army.coord);
    const adjacentToTerritory = neighbors.some((nb) => {
      const nbTile = result.tiles.get(hexKey(nb));
      return nbTile !== undefined && nbTile.owner === army.factionId;
    });

    if (adjacentToTerritory) {
      result = setTile(result, army.coord, { owner: army.factionId });
    }
  }

  return result;
}

/**
 * BFS from all cities of a faction to find connected territory.
 * Returns the set of tile keys reachable from any of the faction's cities.
 */
function findConnectedTiles(
  tiles: ReadonlyMap<string, Tile>,
  cityKeys: readonly string[],
  factionId: FactionId,
): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [];

  for (const key of cityKeys) {
    const tile = tiles.get(key);
    if (tile && tile.owner === factionId) {
      visited.add(key);
      queue.push(key);
    }
  }

  while (queue.length > 0) {
    const currentKey = queue.shift()!;
    const coord = parseHexKey(currentKey);
    const neighbors = hexNeighbors(coord);

    for (const nb of neighbors) {
      const nbKey = hexKey(nb);
      if (visited.has(nbKey)) continue;

      const nbTile = tiles.get(nbKey);
      if (nbTile && nbTile.owner === factionId) {
        visited.add(nbKey);
        queue.push(nbKey);
      }
    }
  }

  return visited;
}

/**
 * Check territory connectivity. Any faction tiles not connected to a city
 * of that faction become neutral.
 */
export function validateConnectivity(state: GameState): GameState {
  let result = state;

  // Collect city tile keys per faction
  const factionCityKeys = new Map<FactionId, string[]>();
  for (const city of state.cities.values()) {
    const keys = factionCityKeys.get(city.factionId) ?? [];
    keys.push(hexKey(city.coord));
    factionCityKeys.set(city.factionId, keys);
  }

  // For each faction, BFS from cities and neutralize disconnected tiles
  for (const [factionId, cityKeys] of factionCityKeys) {
    const connected = findConnectedTiles(result.tiles, cityKeys, factionId);

    for (const [tileKey, tile] of result.tiles) {
      if (tile.owner === factionId && !connected.has(tileKey)) {
        result = setTile(result, tile.coord, { owner: null, cityId: null });
      }
    }
  }

  return result;
}

/**
 * Calculate total territory count per faction (update faction.territoryCount).
 */
export function updateTerritoryCounts(state: GameState): GameState {
  const counts = new Map<FactionId, number>();

  for (const tile of state.tiles.values()) {
    if (tile.owner !== null) {
      counts.set(tile.owner, (counts.get(tile.owner) ?? 0) + 1);
    }
  }

  let result = state;
  for (const faction of state.factions.values()) {
    const count = counts.get(faction.id) ?? 0;
    if (faction.territoryCount !== count) {
      result = updateFaction(result, faction.id, { territoryCount: count });
    }
  }

  return result;
}

/**
 * When a city is captured, all tiles connected to it that can't reach another
 * of the loser's cities become neutral. The city itself transfers to the new owner.
 */
export function transferTerritory(
  state: GameState,
  cityId: CityId,
  newOwner: FactionId,
): GameState {
  const city = state.cities.get(cityId);
  if (!city) return state;

  const loserId = city.factionId;
  let result = state;

  // Transfer the city
  const newCities = new Map(result.cities);
  newCities.set(cityId, { ...city, factionId: newOwner, isCapital: false });
  result = { ...result, cities: newCities };

  // Transfer the city tile
  result = setTile(result, city.coord, { owner: newOwner });

  // Find which loser tiles are still connected to the loser's remaining cities
  const loserCityKeys: string[] = [];
  for (const c of result.cities.values()) {
    if (c.factionId === loserId) {
      loserCityKeys.push(hexKey(c.coord));
    }
  }

  if (loserCityKeys.length > 0) {
    const connected = findConnectedTiles(result.tiles, loserCityKeys, loserId);

    for (const [tileKey, tile] of result.tiles) {
      if (tile.owner === loserId && !connected.has(tileKey)) {
        result = setTile(result, tile.coord, { owner: null, cityId: null });
      }
    }
  } else {
    // Loser has no more cities -- all their tiles become neutral
    for (const [, tile] of result.tiles) {
      if (tile.owner === loserId) {
        result = setTile(result, tile.coord, { owner: null, cityId: null });
      }
    }
  }

  return result;
}
