import { Prisma } from "@prisma/client";
import { isChoiceType } from "./ai/provider";
import { isLevel } from "./levels";

const TYPES = ["MULTIPLE_CHOICE", "OPEN", "FIND_ERROR", "FIX_MESSAGE", "BEST_RESPONSE"] as const;

// Общая проверка вопроса для ручного создания и правки.
export function validateQuestion(q: any):
  | { error: string }
  | { data: Prisma.QuestionUncheckedCreateInput } {
  if (!TYPES.includes(q.type)) return { error: "Неизвестный тип вопроса" };
  if (!isLevel(q.level) || q.level === "EXAM") return { error: "Уровень: BEGINNER, MIDDLE или PROFESSIONAL" };
  const text = String(q.text ?? "").trim();
  if (!text) return { error: "Введите текст вопроса" };
  const explanation = q.explanation ? String(q.explanation).trim() || null : null;

  if (isChoiceType(q.type)) {
    const options = Array.isArray(q.options) ? q.options.map((o: unknown) => String(o).trim()).filter(Boolean) : [];
    const correctIndex = Number(q.correctIndex);
    if (options.length < 2) return { error: "Нужно минимум 2 варианта ответа" };
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      return { error: "Отметьте правильный вариант" };
    }
    return { data: { type: q.type, level: q.level, text, options, correctIndex, expectedKeywords: Prisma.DbNull, explanation } };
  }

  const keywords = Array.isArray(q.expectedKeywords)
    ? q.expectedKeywords.map((k: unknown) => String(k).trim()).filter(Boolean)
    : [];
  if (!keywords.length) return { error: "Укажите ключевые слова правильного ответа" };
  return { data: { type: q.type, level: q.level, text, options: Prisma.DbNull, correctIndex: null, expectedKeywords: keywords, explanation } };
}
