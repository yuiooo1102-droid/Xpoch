import OpenAI from "openai";
import type { AIAdapter, TurnDecision, GameState, FactionId } from "@xpoch/shared";
import { buildPrompt } from "./prompt-builder";
import { parseAIResponse } from "./response-parser";
import { buildIdMap, remapIds } from "./id-mapper";

export class OpenAICompatibleAdapter implements AIAdapter {
  readonly providerId: string;
  private client: OpenAI;
  private model: string;

  constructor(providerId: string, apiKey: string, baseURL: string, model: string) {
    this.providerId = providerId;
    this.client = new OpenAI({ apiKey, baseURL });
    this.model = model;
  }

  async decideActions(
    state: GameState,
    factionId: FactionId,
  ): Promise<TurnDecision> {
    const prompt = buildPrompt(state, factionId);
    const idMap = buildIdMap(state, factionId);

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const decision = parseAIResponse(text, factionId);
    return remapIds(decision, idMap);
  }
}
