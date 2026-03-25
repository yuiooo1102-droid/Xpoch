import type { Action, GameState, HexCoord } from "@xpoch/shared";
import { hexKey, hexDistance } from "@xpoch/shared";
import { RECRUIT_COST } from "@xpoch/shared";

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

export function validateAction(
  state: GameState,
  action: Action
): ValidationResult {
  const faction = state.factions.get(action.factionId);
  if (!faction || !faction.alive) {
    return { valid: false, reason: "Faction not found or eliminated" };
  }

  switch (action.type) {
    case "pass":
      return { valid: true };
    case "move":
    case "attack":
      return validateMoveOrAttack(state, action);
    case "recruit":
      return validateRecruit(state, action);
    case "declare_war":
    case "propose_alliance":
    case "break_alliance":
      return validateDiplomacy(state, action);
    case "trade":
      return validateTrade(state, action);
    default:
      return { valid: false, reason: `Unknown action type: ${action.type}` };
  }
}

function validateMoveOrAttack(
  state: GameState,
  action: Action
): ValidationResult {
  if (!action.from || !action.to || !action.amount) {
    return { valid: false, reason: "Move/attack requires from, to, and amount" };
  }

  const fromTile = state.tiles.get(hexKey(action.from));
  if (!fromTile) return { valid: false, reason: "Source tile does not exist" };
  if (fromTile.owner !== action.factionId) {
    return { valid: false, reason: "Source tile not owned by faction" };
  }
  if (fromTile.army < action.amount) {
    return { valid: false, reason: "Not enough army at source" };
  }

  const toTile = state.tiles.get(hexKey(action.to));
  if (!toTile) return { valid: false, reason: "Target tile does not exist" };
  if (toTile.terrain === "water") {
    return { valid: false, reason: "Cannot move to water tile" };
  }

  if (hexDistance(action.from, action.to) !== 1) {
    return { valid: false, reason: "Can only move to adjacent tiles" };
  }

  return { valid: true };
}

function validateRecruit(
  state: GameState,
  action: Action
): ValidationResult {
  if (!action.from || !action.amount) {
    return { valid: false, reason: "Recruit requires from and amount" };
  }

  const tile = state.tiles.get(hexKey(action.from));
  if (!tile) return { valid: false, reason: "Tile does not exist" };
  if (tile.owner !== action.factionId) {
    return { valid: false, reason: "Tile not owned by faction" };
  }

  const faction = state.factions.get(action.factionId)!;
  const cost = action.amount * RECRUIT_COST;
  if (faction.gold < cost) {
    return { valid: false, reason: "Not enough gold to recruit" };
  }

  return { valid: true };
}

function validateDiplomacy(
  state: GameState,
  action: Action
): ValidationResult {
  if (!action.targetFactionId) {
    return { valid: false, reason: "Diplomacy action requires targetFactionId" };
  }
  if (action.targetFactionId === action.factionId) {
    return { valid: false, reason: "Cannot target self" };
  }
  const target = state.factions.get(action.targetFactionId);
  if (!target || !target.alive) {
    return { valid: false, reason: "Target faction not found or eliminated" };
  }
  return { valid: true };
}

function validateTrade(
  state: GameState,
  action: Action
): ValidationResult {
  if (!action.targetFactionId || !action.amount) {
    return { valid: false, reason: "Trade requires targetFactionId and amount" };
  }
  const faction = state.factions.get(action.factionId)!;
  if (faction.gold < action.amount) {
    return { valid: false, reason: "Not enough gold to trade" };
  }
  return { valid: true };
}
