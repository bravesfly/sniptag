// src/lib/ai-providers.ts

// This file is refactored for Cloudflare Workers AI.
// The concept of multiple providers and API keys is no longer used.

export const textGenerationModels = [
  "@hf/meta-llama/meta-llama-3-8b-instruct",
  "@cf/qwen/qwq-32b"
] as const;

export type TextGenerationModel = (typeof textGenerationModels)[number];


export interface AIModel {
  id: TextGenerationModel;
  name: string;
  description: string;
  maxTokens: number;
  capabilities: string[];
}

// AI configuration for Cloudflare AI
export interface AIConfig {
  model: TextGenerationModel;
  temperature?: number;
  maxTokens?: number;
}

// The single provider is Cloudflare AI
export const CLOUDFLARE_AI_PROVIDER = {
  id: "cloudflare",
  name: "Cloudflare AI",
  description: "AI models running on Cloudflare's global network.",
  models: [
    {
      id: "@hf/meta-llama/meta-llama-3-8b-instruct",
      name: "Llama 3 8B Instruct",
      description: "Meta's Llama 3 8B model for chat and instruction.",
      maxTokens: 128000,
      capabilities: ["text-analysis", "tag-generation", "summarization", "json-output"],
    },
    {
      id: "@cf/qwen/qwq-32b",
      name: "Qwq 32B",
      description: "Qwq 32B model, good for general tasks.",
      maxTokens: 128000,
      capabilities: ["text-analysis", "tag-generation", "summarization"],
    },
  ] as AIModel[],
};

// Default AI configuration
export const DEFAULT_AI_CONFIG: AIConfig = {
  model: "@cf/qwen/qwq-32b",
  temperature: 0.5,
  maxTokens: 128000,
};