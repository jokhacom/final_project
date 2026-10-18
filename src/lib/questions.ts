import { Prisma } from "@prisma/client";
import { isChoiceType } from "./ai/provider";
import { isLevel } from "./levels";

const TYPES = ["MULTIPLE_CHOICE", "OPEN", "FIND_ERROR", "FIX_MESSAGE", "BEST_RESPONSE"] as const;

// Скриншот хранится в базе как data URL. Браузер сжимает картинку перед отправкой,
// поэтому 2 МБ с запасом хватает и укладывается в лимит запроса Vercel.
const MAX_IMAGE_LENGTH = 2_000_000;

function parseImage(value: unknown): { image: string | null } | { error: string } {
  if (value == null || value === "") return { image: null };
  const image = String(value);
  if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(image)) return { error: "Скриншот должен быть картинкой PNG, JPG, WEBP или GIF" };
  if (image.length > MAX_IMAGE_LENGTH) return { error: "Скриншот слишком большой — уменьшите его" };
  return { image };
}

// Общая проверка вопроса для ручного создания, правки и импорта.
export function validateQuestion(q: any):
  | { error: string }
  | { data: Prisma.QuestionUncheckedCreateInput } {
  if (!TYPES.includes(q.type)) return { error: "Неизвестный тип вопроса" };
  if (!isLevel(q.level)) return { error: "Уровень: BEGINNER, MIDDLE, PROFESSIONAL или EXAM" };
  const text = String(q.text ?? "").trim();
  if (!text) return { error: "Введите текст вопроса" };
  const explanation = q.explanation ? String(q.explanation).trim() || null : null;
  const img = parseImage(q.image);
  if ("error" in img) return img;

  if (isChoiceType(q.type)) {
    const options = Array.isArray(q.options) ? q.options.map((o: unknown) => String(o).trim()).filter(Boolean) : [];
    const correctIndex = Number(q.correctIndex);
    if (options.length < 2) return { error: "Нужно минимум 2 варианта ответа" };
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      return { error: "Отметьте правильный вариант" };
    }
    return {
      data: { type: q.type, level: q.level, text, options, correctIndex, expectedKeywords: Prisma.DbNull, modelAnswer: null, explanation, image: img.image },
    };
  }

  const keywords = Array.isArray(q.expectedKeywords)
    ? q.expectedKeywords.map((k: unknown) => String(k).trim()).filter(Boolean)
    : [];
  const modelAnswer = q.modelAnswer ? String(q.modelAnswer).trim() || null : null;
  if (!keywords.length && !modelAnswer) return { error: "Напишите эталонный ответ или ключевые слова" };
  return {
    data: {
      type: q.type,
      level: q.level,
      text,
      options: Prisma.DbNull,
      correctIndex: null,
      expectedKeywords: keywords.length ? keywords : Prisma.DbNull,
      modelAnswer,
      explanation,
      image: img.image,
    },
  };
}
