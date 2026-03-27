/**
 * Test what the AI prompt looks like and how a local model responds.
 * Usage: npx tsx scripts/test-prompt.ts
 */
import { createInitialState } from "@xpoch/engine";
import { buildPrompt } from "@xpoch/ai-adapter";

async function main() {
  const state = createInitialState(12, 42, [
    { id: "f0", name: "蜀汉", modelProvider: "mock", color: "#8B5CF6", historicalFaction: "shu" as const },
    { id: "f1", name: "魏国", modelProvider: "mock", color: "#10B981", historicalFaction: "wei" as const },
    { id: "f2", name: "吴国", modelProvider: "mock", color: "#3B82F6", historicalFaction: "wu" as const },
  ]);

  const prompt = buildPrompt(state, "f0");
  console.log("=== PROMPT ===");
  console.log(prompt);
  console.log("\n=== STATS ===");
  console.log("Characters:", prompt.length);
  console.log("Est tokens:", Math.ceil(prompt.length / 2));

  console.log("\n=== SENDING TO GLM-4.7-Flash ===\n");

  const resp = await fetch("http://localhost:11434/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "glm-4.7-flash:latest",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content ?? "(empty)";
  console.log("=== AI RESPONSE ===");
  console.log(text);

  // Try to parse
  console.log("\n=== PARSE RESULT ===");
  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    console.log("Valid JSON:", JSON.stringify(parsed, null, 2).slice(0, 500));
  } catch (e) {
    console.log("PARSE FAILED:", (e as Error).message);
    console.log("Raw response was:", text.slice(0, 300));
  }
}

main().catch(console.error);
