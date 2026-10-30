import Anthropic from "@anthropic-ai/sdk";
import type { Complete } from "./prompts";

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

// Серверный повтор при отказе модели (fallbacks) есть у Opus, Sonnet и Fable, но не у Haiku.
const SUPPORTS_FALLBACKS = /^claude-(opus|sonnet|fable)-/.test(ANTHROPIC_MODEL);

let client: Anthropic | null = null;

export const anthropicComplete: Complete = async (prompt, maxTokens, opts) => {
  client ??= new Anthropic(); // ключ берётся из ANTHROPIC_API_KEY
  // «Размышления» модели входят в max_tokens, поэтому даём запас, чтобы ответ не обрезался.
  // Стриминг + finalMessage — чтобы длинные ответы (разбор документа) не упирались в таймаут.
  // fast — меньше «размышлений» (effort low): быстрее и укладывается в 60 с функции Vercel.
  const params = {
    model: ANTHROPIC_MODEL,
    max_tokens: Math.max(maxTokens * 2, 16000),
    messages: [
      {
        role: "user" as const,
        // Картинки (скриншот переписки) — перед текстом запроса.
        content: [
          ...(opts?.images ?? []).map((i) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: i.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: i.data },
          })),
          { type: "text" as const, text: prompt },
        ],
      },
    ],
    ...(opts?.fast ? { output_config: { effort: "low" as const } } : {}),
  };
  const message: { stop_reason: string | null; content: { type: string; text?: string }[] } = SUPPORTS_FALLBACKS
    ? await client.beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }).finalMessage()
    : await client.messages.stream(params).finalMessage();

  if (message.stop_reason === "refusal") throw new Error("Claude отказался обрабатывать запрос");
  return message.content.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("");
};
