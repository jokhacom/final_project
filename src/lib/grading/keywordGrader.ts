import type { GradeResult } from "../ai/provider";

// Первая, "обычная" (не-ИИ) проверка открытых ответов: считаем ответ верным,
// если в нём встречается хотя бы одно из ожидаемых ключевых слов/фраз.
// Орфографию и грамматику здесь не проверяем (для этого и нужен будет ИИ позже) —
// пока просто 0 ошибок, чтобы система оценки уже работала целиком.
export function gradeByKeywords(expectedKeywords: string[], answer: string): GradeResult {
  const lower = (answer || "").toLowerCase();
  const correct = expectedKeywords.some((k) => lower.includes(k.toLowerCase()));

  return {
    correct,
    spellingErrors: 0,
    grammarErrors: 0,
    comment: correct
      ? "Ответ засчитан (совпадение по ключевым словам)."
      : "Ответ не содержит ожидаемых ключевых слов — засчитан как неверный.",
  };
}
