import type { GameKind } from "@prisma/client";

// Общая проверка элемента игры для ручного создания, правки и ответа ИИ.
export function validateGameItem(g: any):
  | { error: string }
  | { data: { kind: GameKind; prompt: string; answer: string | null; isCorrect: boolean | null; explanation: string | null } } {
  if (g.kind !== "TRUE_FALSE" && g.kind !== "FLASHCARD") return { error: "Неизвестный тип игры" };
  const prompt = String(g.prompt ?? "").trim();
  if (!prompt) return { error: g.kind === "TRUE_FALSE" ? "Введите фразу" : "Введите ситуацию" };
  const explanation = g.explanation ? String(g.explanation).trim() || null : null;

  if (g.kind === "TRUE_FALSE") {
    if (typeof g.isCorrect !== "boolean") return { error: "Отметьте, можно так говорить или нельзя" };
    return { data: { kind: g.kind, prompt, answer: null, isCorrect: g.isCorrect, explanation } };
  }
  const answer = String(g.answer ?? "").trim();
  if (!answer) return { error: "Напишите правильный ответ на обратной стороне карточки" };
  return { data: { kind: g.kind, prompt, answer, isCorrect: null, explanation } };
}
