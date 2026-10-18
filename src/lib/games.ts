import { Prisma, type GameKind } from "@prisma/client";
import { parseImage } from "./questions";

// FLASHCARD остаётся в базе для старых записей, но в интерфейсе заменён «Грамотностью».
export const GAME_KINDS = ["TRUE_FALSE", "FIX_ERROR", "LANGUAGE"] as const;
export const isGameKind = (k: unknown): k is GameKind => GAME_KINDS.includes(k as (typeof GAME_KINDS)[number]);

export { LANGUAGE_ROUND, LANGUAGE_SECONDS, isGameLanguage } from "./gameConstants";
import { isGameLanguage } from "./gameConstants";

type GameItemData = {
  kind: GameKind;
  prompt: string;
  answer: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
  image: string | null;
  options: string[] | typeof Prisma.DbNull;
  correctIndex: number | null;
  language: string | null;
  category: string | null;
};

const EMPTY = { answer: null, isCorrect: null, image: null, options: Prisma.DbNull, correctIndex: null, language: null, category: null };

// Общая проверка элемента игры для ручного создания, правки и ответа ИИ.
export function validateGameItem(g: any): { error: string } | { data: GameItemData } {
  if (!isGameKind(g.kind)) return { error: "Неизвестный тип игры" };
  const prompt = String(g.prompt ?? "").trim();
  const explanation = g.explanation ? String(g.explanation).trim() || null : null;

  if (g.kind === "LANGUAGE") {
    if (!isGameLanguage(g.language)) return { error: "Выберите язык: русский или узбекский" };
    if (!prompt) return { error: "Введите вопрос" };
    const options = (Array.isArray(g.options) ? g.options : []).map((o: unknown) => String(o ?? "").trim()).filter(Boolean);
    if (options.length < 2 || options.length > 4) return { error: "Нужно от 2 до 4 вариантов ответа" };
    const correctIndex = Number(g.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return { error: "Отметьте правильный вариант" };
    const category = g.category ? String(g.category).trim() || null : null;
    return { data: { ...EMPTY, kind: g.kind, prompt, explanation, options, correctIndex, language: g.language, category } };
  }

  if (g.kind === "FIX_ERROR") {
    const img = parseImage(g.image);
    if ("error" in img) return img;
    if (!prompt && !img.image) return { error: "Добавьте скриншот или текст сообщения с ошибкой" };
    const answer = String(g.answer ?? "").trim();
    if (!answer) return { error: "Напишите правильный вариант" };
    return { data: { ...EMPTY, kind: g.kind, prompt, answer, explanation, image: img.image } };
  }

  if (!prompt) return { error: "Введите фразу" };
  if (typeof g.isCorrect !== "boolean") return { error: "Отметьте, можно так говорить или нельзя" };
  return { data: { ...EMPTY, kind: g.kind, prompt, isCorrect: g.isCorrect, explanation } };
}
