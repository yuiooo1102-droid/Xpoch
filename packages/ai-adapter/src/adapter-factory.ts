import type { AIAdapter } from "@xpoch/shared";
import { ClaudeAdapter } from "./claude-adapter";
import { GeminiAdapter } from "./gemini-adapter";
import { OpenAICompatibleAdapter } from "./openai-compatible-adapter";
import { MockAdapter } from "./mock-adapter";
import { getProvider } from "./providers";

export interface PlayerConfig {
  readonly modelProvider: string;
  readonly apiKey?: string;
  readonly model?: string;
  readonly name: string;
}

export function createAdapter(config: PlayerConfig): AIAdapter {
  const provider = getProvider(config.modelProvider);

  if (!provider || config.modelProvider === "mock") {
    return new MockAdapter();
  }

  const apiKey = config.apiKey || process.env[provider.envKey] || "";
  const model = config.model || provider.defaultModel;

  // Local providers (ollama, mlx-local) don't need API keys
  const isLocal = provider.id === "ollama" || provider.id === "mlx-local";

  if (!apiKey && !isLocal) {
    console.warn(`No API key for ${provider.name} — ${config.name} falls back to mock`);
    return new MockAdapter();
  }

  switch (provider.apiStyle) {
    case "anthropic":
      return new ClaudeAdapter(apiKey, model);

    case "google":
      return new GeminiAdapter(apiKey, model);

    case "openai-compatible":
      return new OpenAICompatibleAdapter(
        provider.id,
        apiKey,
        provider.baseUrl ?? "https://api.openai.com/v1",
        model
      );

    default:
      return new MockAdapter();
  }
}
