import { createProvider } from "./prompts";

// Бесплатный вариант: Google Gemini API (ключ в Google AI Studio, есть бесплатный лимит).
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const geminiProvider = createProvider(async (prompt, maxTokens) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Не задан GEMINI_API_KEY");

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, responseMimeType: "application/json" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini: ${data?.error?.message ?? res.status}`);
  return (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
});
