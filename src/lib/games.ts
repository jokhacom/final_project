import type { GameKind } from "@prisma/client";
import { parseImage } from "./questions";

export const GAME_KINDS = ["TRUE_FALSE", "FLASHCARD", "FIX_ERROR"] as const;
export const isGameKind = (k: unknown): k is GameKind => GAME_KINDS.includes(k as GameKind);

type GameItemData = { kind: GameKind; prompt: string; answer: string | null; isCorrect: boolean | null; explanation: string | null; image: string | null };

// Общая проверка элемента игры для ручного создания, правки и ответа ИИ.
export function validateGameItem(g: any): { error: string } | { data: GameItemData } {
  if (!isGameKind(g.kind)) return { error: "Неизвестный тип игры" };
  const prompt = String(g.prompt ?? "").trim();
  const explanation = g.explanation ? String(g.explanation).trim() || null : null;

  if (g.kind === "FIX_ERROR") {
    const img = parseImage(g.image);
    if ("error" in img) return img;
    if (!prompt && !img.image) return { error: "Добавьте скриншот или текст сообщения с ошибкой" };
    const answer = String(g.answer ?? "").trim();
    if (!answer) return { error: "Напишите правильный вариант" };
    return { data: { kind: g.kind, prompt, answer, isCorrect: null, explanation, image: img.image } };
  }

  if (!prompt) return { error: g.kind === "TRUE_FALSE" ? "Введите фразу" : "Введите ситуацию" };
  if (g.kind === "TRUE_FALSE") {
    if (typeof g.isCorrect !== "boolean") return { error: "Отметьте, можно так говорить или нельзя" };
    return { data: { kind: g.kind, prompt, answer: null, isCorrect: g.isCorrect, explanation, image: null } };
  }
  const answer = String(g.answer ?? "").trim();
  if (!answer) return { error: "Напишите правильный ответ на обратной стороне карточки" };
  return { data: { kind: g.kind, prompt, answer, isCorrect: null, explanation, image: null } };
}
