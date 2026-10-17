import { createProvider } from "./prompts";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export const openaiProvider = createProvider(async (prompt, maxTokens) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Не задан OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI: ${data?.error?.message ?? res.status}`);
  return data.choices?.[0]?.message?.content ?? "";
});
