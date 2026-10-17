import { features } from "../config/features";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { openaiProvider } from "./openai";
import type { AIProvider } from "./provider";

// Единственное место в проекте, где выбирается конкретный AI-провайдер.
// Всё остальное приложение импортирует aiProvider отсюда и не знает деталей.
const providers: Record<string, AIProvider> = {
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  openai: openaiProvider,
};

export const aiProvider: AIProvider = providers[features.AI_PROVIDER] ?? anthropicProvider;

export * from "./provider";
