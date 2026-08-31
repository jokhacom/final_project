import { features } from "../config/features";
import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import type { AIProvider } from "./provider";

// Единственное место в проекте, где выбирается конкретный AI-провайдер.
// Всё остальное приложение импортирует aiProvider отсюда и не знает деталей.
export const aiProvider: AIProvider = features.AI_PROVIDER === "openai" ? openaiProvider : anthropicProvider;

export * from "./provider";
