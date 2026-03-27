import OpenAI from "openai";
import type { AIAdapter, TurnDecision, GameState, FactionId } from "@xpoch/shared";
import { buildPrompt } from "./prompt-builder";
import { parseAIResponse } from "./response-parser";
import { buildIdMap, remapIds } from "./id-mapper";

export class OpenAICompatibleAdapter implements AIAdapter {
  readonly providerId: string;
  private client: OpenAI;
  private model: string;
  private baseURL: string;

  constructor(providerId: string, apiKey: string, baseURL: string, model: string) {
    this.providerId = providerId;
    this.client = new OpenAI({ apiKey, baseURL });
    this.model = model;
    this.baseURL = baseURL;
  }

  async decideActions(
    state: GameState,
    factionId: FactionId,
  ): Promise<TurnDecision> {
    const prompt = buildPrompt(state, factionId);
    const idMap = buildIdMap(state, factionId);

    // For Ollama: use native API to avoid reasoning/content split bug
    const isOllama = this.baseURL.includes("11434");
    const text = isOllama
      ? await this.callOllamaNative(prompt)
      : await this.callOpenAICompat(prompt);

    const decision = parseAIResponse(text, factionId);
    return remapIds(decision, idMap);
  }

  private async callOllamaNative(prompt: string): Promise<string> {
    const ollamaUrl = this.baseURL.replace("/v1", "");
    const resp = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
      }),
    });
    const data = await resp.json();
    return (data as { response?: string }).response ?? "";
  }

  private async callOpenAICompat(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 2048,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const msg = response.choices[0]?.message;
    let text = msg?.content ?? "";

    // Fallback: some models put content in reasoning field
    if (!text && msg) {
      const raw = msg as Record<string, unknown>;
      if (typeof raw.reasoning === "string") {
        text = extractJsonFromText(raw.reasoning);
      }
    }

    return text;
  }
}

function extractJsonFromText(text: string): string {
  const mdMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (mdMatch) return mdMatch[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text;
}
