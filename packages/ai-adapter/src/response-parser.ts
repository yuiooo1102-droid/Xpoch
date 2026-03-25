import type { Action, FactionId, HexCoord } from "@xpoch/shared";
import { parseHexKey, MAX_ACTIONS_PER_TURN } from "@xpoch/shared";

interface RawAction {
  type?: string;
  from?: string;
  to?: string;
  amount?: number;
  targetFactionId?: string;
}

export function parseAIResponse(
  raw: string,
  factionId: FactionId
): Action[] {
  const passAction: Action = { factionId, type: "pass" };

  try {
    const cleaned = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [passAction];

    const actions: Action[] = parsed
      .slice(0, MAX_ACTIONS_PER_TURN)
      .map((raw: RawAction) => toAction(raw, factionId))
      .filter((a): a is Action => a !== null);

    return actions.length > 0 ? actions : [passAction];
  } catch {
    return [passAction];
  }
}

function toAction(raw: RawAction, factionId: FactionId): Action | null {
  if (!raw.type) return null;

  const action: Action = {
    factionId,
    type: raw.type as Action["type"],
    from: raw.from ? safeParseHex(raw.from) : undefined,
    to: raw.to ? safeParseHex(raw.to) : undefined,
    amount: raw.amount,
    targetFactionId: raw.targetFactionId,
  };

  return action;
}

function safeParseHex(s: string): HexCoord | undefined {
  try {
    return parseHexKey(s);
  } catch {
    return undefined;
  }
}
