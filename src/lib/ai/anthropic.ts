import Anthropic from "@anthropic-ai/sdk";
import type { Complete } from "./prompts";

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

// Серверный повтор при отказе модели (fallbacks) есть у Opus, Sonnet и Fable, но не у Haiku.
const SUPPORTS_FALLBACKS = /^claude-(opus|sonnet|fable)-/.test(ANTHROPIC_MODEL);

let client: Anthropic | null = null;

export const anthropicComplete: Complete = async (prompt, maxTokens) => {
  client ??= new Anthropic(); // ключ берётся из ANTHROPIC_API_KEY
  // «Размышления» модели входят в max_tokens, поэтому даём запас, чтобы ответ не обрезался.
  // Стриминг + finalMessage — чтобы длинные ответы (разбор документа) не упирались в таймаут.
  const params = {
    model: ANTHROPIC_MODEL,
    max_tokens: Math.max(maxTokens, 8000),
    messages: [{ role: "user" as const, content: prompt }],
  };
  const message: { stop_reason: string | null; content: { type: string; text?: string }[] } = SUPPORTS_FALLBACKS
    ? await client.beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }).finalMessage()
    : await client.messages.stream(params).finalMessage();

  if (message.stop_reason === "refusal") throw new Error("Claude отказался обрабатывать запрос");
  return message.content.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("");
};
