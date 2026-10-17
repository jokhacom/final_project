import { features, PROVIDER_LABEL, type Provider } from "../config/features";
import { anthropicComplete } from "./anthropic";
import { geminiComplete } from "./gemini";
import { openaiComplete } from "./openai";
import { createProvider, type Complete } from "./prompts";
import type { AIProvider } from "./provider";

// Единственное место в проекте, где выбирается конкретный AI-провайдер.
// Всё остальное приложение импортирует aiProvider отсюда и не знает деталей.
const COMPLETE: Record<Provider, Complete> = {
  gemini: geminiComplete,
  anthropic: anthropicComplete,
  openai: openaiComplete,
};

// Если провайдер ответил «лимит исчерпан» (429), какое-то время не дёргаем его,
// а сразу идём к запасному. Хранится в памяти серверной функции.
const COOLDOWN_MS = 15 * 60 * 1000;
const coolingUntil: Partial<Record<Provider, number>> = {};

const chained: Complete = async (prompt, maxTokens) => {
  const chain = features.AI_CHAIN;
  const ready = chain.filter((p) => (coolingUntil[p] ?? 0) < Date.now());
  const order = ready.length ? ready : chain; // если все «остывают» — всё равно пробуем по порядку
  let lastError: unknown;

  for (const p of order) {
    try {
      return await COMPLETE[p](prompt, maxTokens);
    } catch (e) {
      lastError = e;
      if ((e as { status?: number }).status === 429) coolingUntil[p] = Date.now() + COOLDOWN_MS;
      console.error(`AI provider ${PROVIDER_LABEL[p]} failed, trying next:`, e);
    }
  }
  throw lastError ?? new Error("ИИ не подключён");
};

export const aiProvider: AIProvider = createProvider(chained);

export * from "./provider";
