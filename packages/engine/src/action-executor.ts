import type { Action, GameState, FactionId, HexCoord } from "@xpoch/shared";
import { hexKey, RECRUIT_COST } from "@xpoch/shared";
import {
  setTileOwner,
  updateFaction,
  addLogEntry,
  getTile,
  getFaction,
} from "./game-state";
import { validateAction } from "./action-validator";
import { resolveCombat } from "./combat-resolver";

export function executeAction(state: GameState, action: Action): GameState {
  const validation = validateAction(state, action);
  if (!validation.valid) {
    return addLogEntry(
      state,
      `[${action.factionId}] Invalid action ${action.type}: ${validation.reason}`,
      [action.factionId]
    );
  }

  switch (action.type) {
    case "pass":
      return state;
    case "move":
      return executeMove(state, action);
    case "attack":
      return executeAttack(state, action);
    case "recruit":
      return executeRecruit(state, action);
    case "declare_war":
      return executeDeclareWar(state, action);
    case "propose_alliance":
      return executeProposeAlliance(state, action);
    case "break_alliance":
      return executeBreakAlliance(state, action);
    case "trade":
      return executeTrade(state, action);
    default:
      return state;
  }
}

function executeMove(state: GameState, action: Action): GameState {
  const from = action.from!;
  const to = action.to!;
  const amount = action.amount!;

  const fromTile = getTile(state, from)!;
  const toTile = getTile(state, to)!;

  if (toTile.owner === action.factionId) {
    let s = setTileOwner(state, from, fromTile.army - amount > 0 ? action.factionId : null, fromTile.army - amount);
    s = setTileOwner(s, to, action.factionId, toTile.army + amount);
    return addLogEntry(s, `${action.factionId} reinforced (${hexKey(from)} → ${hexKey(to)}) +${amount}`, [action.factionId]);
  }

  if (!toTile.owner) {
    let s = setTileOwner(state, from, fromTile.army - amount > 0 ? action.factionId : null, fromTile.army - amount);
    s = setTileOwner(s, to, action.factionId, amount);
    return addLogEntry(s, `${action.factionId} claimed ${hexKey(to)}`, [action.factionId]);
  }

  return executeAttack(state, action);
}

function executeAttack(state: GameState, action: Action): GameState {
  const from = action.from!;
  const to = action.to!;
  const attackers = action.amount!;

  const fromTile = getTile(state, from)!;
  const toTile = getTile(state, to)!;
  const defenders = toTile.army;
  const defenderId = toTile.owner!;

  const combat = resolveCombat(attackers, defenders);

  let s = setTileOwner(state, from, fromTile.army - attackers > 0 ? action.factionId : null, fromTile.army - attackers);

  if (combat.attackerWins) {
    s = setTileOwner(s, to, action.factionId, combat.remainingAttackers);
    s = addLogEntry(s, `${action.factionId} conquered ${hexKey(to)} from ${defenderId}! (${attackers} vs ${defenders})`, [action.factionId, defenderId]);
  } else {
    s = setTileOwner(s, to, defenderId, combat.remainingDefenders);
    s = addLogEntry(s, `${action.factionId} failed to take ${hexKey(to)} from ${defenderId} (${attackers} vs ${defenders})`, [action.factionId, defenderId]);
  }

  return s;
}

function executeRecruit(state: GameState, action: Action): GameState {
  const amount = action.amount!;
  const cost = amount * RECRUIT_COST;
  const tile = getTile(state, action.from!)!;

  let s = setTileOwner(state, action.from!, action.factionId, tile.army + amount);
  s = updateFaction(s, action.factionId, {
    gold: getFaction(s, action.factionId)!.gold - cost,
  });
  s = addLogEntry(s, `${action.factionId} recruited ${amount} units at ${hexKey(action.from!)}`, [action.factionId]);
  return s;
}

function diplomaticKey(a: FactionId, b: FactionId): string {
  return [a, b].sort().join(":");
}

function executeDeclareWar(state: GameState, action: Action): GameState {
  const key = diplomaticKey(action.factionId, action.targetFactionId!);
  const newRelations = new Map(state.diplomacy.relations);
  newRelations.set(key, "war");

  let s: GameState = { ...state, diplomacy: { relations: newRelations } };
  s = addLogEntry(s, `${action.factionId} declared WAR on ${action.targetFactionId}!`, [action.factionId, action.targetFactionId!]);
  return s;
}

function executeProposeAlliance(state: GameState, action: Action): GameState {
  const key = diplomaticKey(action.factionId, action.targetFactionId!);
  const newRelations = new Map(state.diplomacy.relations);
  newRelations.set(key, "allied");

  let s: GameState = { ...state, diplomacy: { relations: newRelations } };
  s = addLogEntry(s, `${action.factionId} formed ALLIANCE with ${action.targetFactionId}`, [action.factionId, action.targetFactionId!]);
  return s;
}

function executeBreakAlliance(state: GameState, action: Action): GameState {
  const key = diplomaticKey(action.factionId, action.targetFactionId!);
  const newRelations = new Map(state.diplomacy.relations);
  newRelations.set(key, "neutral");

  let s: GameState = { ...state, diplomacy: { relations: newRelations } };
  s = addLogEntry(s, `${action.factionId} BETRAYED alliance with ${action.targetFactionId}!`, [action.factionId, action.targetFactionId!]);
  return s;
}

function executeTrade(state: GameState, action: Action): GameState {
  const amount = action.amount!;
  const sender = getFaction(state, action.factionId)!;
  const receiver = getFaction(state, action.targetFactionId!)!;

  let s = updateFaction(state, action.factionId, { gold: sender.gold - amount });
  s = updateFaction(s, action.targetFactionId!, { gold: receiver.gold + amount });
  s = addLogEntry(s, `${action.factionId} traded ${amount} gold to ${action.targetFactionId}`, [action.factionId, action.targetFactionId!]);
  return s;
}
