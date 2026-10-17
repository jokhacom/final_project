import type { GradeResult } from "../ai/provider";

// Проверка открытых ответов без ИИ. Если заданы ключевые слова — ответ верный,
// когда в нём есть хотя бы одно из них. Если ключевых слов нет, сравниваем с
// эталонным ответом: верно, если совпадает хотя бы треть его значимых слов
// (сравниваем по началу слова, чтобы «проверю» и «проверить» считались одним словом).
// Орфографию и грамматику без ИИ не проверяем.
const STEM = 5;
const words = (s: string) =>
  (s.toLowerCase().match(/[a-zа-яё0-9]+/gi) ?? []).filter((w) => w.length >= 4).map((w) => w.slice(0, STEM));

export function gradeByKeywords(expectedKeywords: string[], answer: string, modelAnswer?: string | null): GradeResult {
  const lower = (answer || "").toLowerCase();
  let correct: boolean;

  if (expectedKeywords.length) {
    correct = expectedKeywords.some((k) => lower.includes(k.toLowerCase()));
  } else {
    const reference = [...new Set(words(modelAnswer ?? ""))];
    const mine = new Set(words(answer));
    const matched = reference.filter((w) => mine.has(w)).length;
    correct = reference.length > 0 && matched / reference.length >= 1 / 3;
  }

  return {
    correct,
    spellingErrors: 0,
    grammarErrors: 0,
    comment: correct
      ? "Ответ засчитан: он совпадает с эталонным по ключевым моментам."
      : "Ответ не содержит ключевых моментов эталонного ответа — засчитан как неверный.",
  };
}
