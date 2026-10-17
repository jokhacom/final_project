import type { Complete } from "./prompts";

// Бесплатный вариант: Google Gemini API (ключ в Google AI Studio, есть бесплатный лимит).
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const geminiComplete: Complete = async (prompt, maxTokens) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Не задан GEMINI_API_KEY");

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // «Размышления» модели входят в лимит вывода — даём запас, чтобы JSON не обрезался.
      generationConfig: { maxOutputTokens: Math.max(maxTokens, 8192), responseMimeType: "application/json" },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Gemini: ${data?.error?.message ?? res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini вернул пустой ответ");
  return text;
};
