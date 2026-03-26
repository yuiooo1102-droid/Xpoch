#!/usr/bin/env npx tsx
/**
 * Quick test: verify Ollama adapter works with a single faction call.
 */

import { OpenAICompatibleAdapter } from "@xpoch/ai-adapter";
import { createInitialState } from "@xpoch/engine";

const FACTIONS = [
  { id: "f0", name: "蜀汉·GLM", modelProvider: "ollama", color: "purple" },
  { id: "f1", name: "魏国·Qwen", modelProvider: "ollama", color: "green" },
  { id: "f2", name: "吴国·GLM", modelProvider: "ollama", color: "blue" },
];

async function main() {
  const state = createInitialState(10, Date.now(), FACTIONS);

  const adapter = new OpenAICompatibleAdapter(
    "ollama", "ollama", "http://localhost:11434/v1", "qwen3:8b",
  );

  console.log("Testing qwen3:8b with 30s timeout...");
  const start = Date.now();
  try {
    const decision = await Promise.race([
      adapter.decideActions(state, "f1"),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout 30s")), 30000)),
    ]);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`Done in ${elapsed}s`);
    console.log("Decision:", JSON.stringify(decision).slice(0, 400));
  } catch (err: unknown) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const message = err instanceof Error ? err.message : String(err);
    console.log(`Error after ${elapsed}s:`, message.slice(0, 200));
  }
}

main().catch(console.error);
