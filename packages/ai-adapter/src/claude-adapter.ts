import Anthropic from "@anthropic-ai/sdk";
import type { AIAdapter, TurnDecision, GameState, FactionId } from "@xpoch/shared";
import { buildPrompt } from "./prompt-builder";
import { parseAIResponse } from "./response-parser";
import { buildIdMap, remapIds } from "./id-mapper";

export class ClaudeAdapter implements AIAdapter {
  readonly providerId = "claude";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = "claude-haiku-4-5-20251001") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async decideActions(
    state: GameState,
    factionId: FactionId,
  ): Promise<TurnDecision> {
    const prompt = buildPrompt(state, factionId);
    const idMap = buildIdMap(state, factionId);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const decision = parseAIResponse(text, factionId);
    return remapIds(decision, idMap);
  }
}
