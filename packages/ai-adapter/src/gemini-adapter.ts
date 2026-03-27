import type { AIAdapter, TurnDecision, GameState, FactionId } from "@xpoch/shared";
import { buildPrompt } from "./prompt-builder";
import { parseAIResponse } from "./response-parser";
import { buildIdMap, remapIds } from "./id-mapper";

export class GeminiAdapter implements AIAdapter {
  readonly providerId = "gemini";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "gemini-2.0-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async decideActions(
    state: GameState,
    factionId: FactionId,
  ): Promise<TurnDecision> {
    const prompt = buildPrompt(state, factionId);
    const idMap = buildIdMap(state, factionId);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048 },
      }),
    });

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const decision = parseAIResponse(text, factionId, state);
    return remapIds(decision, idMap);
  }
}
