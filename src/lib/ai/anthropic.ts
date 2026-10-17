import Anthropic from "@anthropic-ai/sdk";
import { createProvider } from "./prompts";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;

export const anthropicProvider = createProvider(async (prompt, maxTokens) => {
  client ??= new Anthropic(); // ключ берётся из ANTHROPIC_API_KEY
  // Стриминг + finalMessage — чтобы длинные ответы (разбор большого документа)
  // не упирались в таймаут HTTP-запроса. fallbacks: "default" — если модель
  // откажется отвечать по соображениям безопасности, API сам повторит запрос
  // на подходящей модели.
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: prompt }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("ИИ отказался обрабатывать запрос");
  return message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
});
