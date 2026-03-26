export interface ProviderDef {
  readonly id: string;
  readonly name: string;
  readonly apiStyle: "openai-compatible" | "anthropic" | "google";
  readonly baseUrl?: string; // for openai-compatible
  readonly defaultModel: string;
  readonly envKey: string; // env var name for API key
}

export const PROVIDERS: readonly ProviderDef[] = [
  {
    id: "openai",
    name: "OpenAI (GPT)",
    apiStyle: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    envKey: "OPENAI_API_KEY",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    apiStyle: "anthropic",
    defaultModel: "claude-haiku-4-5-20251001",
    envKey: "ANTHROPIC_API_KEY",
  },
  {
    id: "gemini",
    name: "Google (Gemini)",
    apiStyle: "google",
    defaultModel: "gemini-2.0-flash",
    envKey: "GEMINI_API_KEY",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    apiStyle: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    envKey: "DEEPSEEK_API_KEY",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    apiStyle: "openai-compatible",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    envKey: "MISTRAL_API_KEY",
  },
  {
    id: "grok",
    name: "xAI (Grok)",
    apiStyle: "openai-compatible",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-3-mini-fast",
    envKey: "XAI_API_KEY",
  },
  {
    id: "qwen",
    name: "Alibaba (Qwen)",
    apiStyle: "openai-compatible",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    envKey: "QWEN_API_KEY",
  },
  {
    id: "zhipu",
    name: "Zhipu (GLM)",
    apiStyle: "openai-compatible",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
    envKey: "ZHIPU_API_KEY",
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    apiStyle: "openai-compatible",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    envKey: "MOONSHOT_API_KEY",
  },
  {
    id: "yi",
    name: "01.AI (Yi)",
    apiStyle: "openai-compatible",
    baseUrl: "https://api.lingyiwanwu.com/v1",
    defaultModel: "yi-large",
    envKey: "YI_API_KEY",
  },
  {
    id: "doubao",
    name: "ByteDance (Doubao)",
    apiStyle: "openai-compatible",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-1-5-pro-256k",
    envKey: "DOUBAO_API_KEY",
  },
  {
    id: "mlx-local",
    name: "MLX Local (Apple Silicon)",
    apiStyle: "openai-compatible",
    baseUrl: "http://localhost:8080/v1",
    defaultModel: "mlx-community/Qwen2.5-7B-Instruct",
    envKey: "",
  },
  {
    id: "ollama",
    name: "Ollama Local",
    apiStyle: "openai-compatible",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen2.5:7b",
    envKey: "",
  },
  {
    id: "mock",
    name: "Mock AI (Testing)",
    apiStyle: "openai-compatible",
    defaultModel: "mock",
    envKey: "",
  },
];

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
