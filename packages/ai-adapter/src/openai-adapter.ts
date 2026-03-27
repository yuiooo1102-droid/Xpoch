import OpenAI from "openai";
import type { AIAdapter, TurnDecision, GameState, FactionId } from "@xpoch/shared";
import { buildPrompt } from "./prompt-builder";
import { parseAIResponse } from "./response-parser";

export class OpenAIAdapter implements AIAdapter {
  readonly providerId = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = "gpt-4o-mini") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async decideActions(
    state: GameState,
    factionId: FactionId,
  ): Promise<TurnDecision> {
    const prompt = buildPrompt(state, factionId);

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0]?.message?.content ?? "";
    return parseAIResponse(text, factionId, state);
  }
}
