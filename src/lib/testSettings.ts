import { db } from "./db";

// Время на тест настраивается в админ-панели (Setting "test_duration_min").
export const DEFAULT_TEST_MINUTES = 15;
export const MIN_TEST_MINUTES = 1;
export const MAX_TEST_MINUTES = 120;

// Сколько вопросов в одном тесте (Setting "test_question_count").
export const QUESTION_COUNTS = [10, 15, 20] as const;
export const DEFAULT_QUESTION_COUNT = 10;

export async function getQuestionCount(): Promise<number> {
  const s = await db.setting.findUnique({ where: { key: "test_question_count" } });
  const n = Number(s?.value);
  return (QUESTION_COUNTS as readonly number[]).includes(n) ? n : DEFAULT_QUESTION_COUNT;
}

// Сколько вопросов каждого уровня берёт итоговый экзамен: 30% / 30% / 40%.
export function examSplit(total: number) {
  const b = Math.round(total * 0.3);
  const m = Math.round(total * 0.3);
  return { BEGINNER: b, MIDDLE: m, PROFESSIONAL: total - b - m };
}

export async function getTestMinutes(): Promise<number> {
  const s = await db.setting.findUnique({ where: { key: "test_duration_min" } });
  const n = Number(s?.value);
  return Number.isInteger(n) && n >= MIN_TEST_MINUTES && n <= MAX_TEST_MINUTES ? n : DEFAULT_TEST_MINUTES;
}
