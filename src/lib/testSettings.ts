import { db } from "./db";

// Время на тест настраивается в админ-панели (Setting "test_duration_min").
export const DEFAULT_TEST_MINUTES = 15;
export const MIN_TEST_MINUTES = 1;
export const MAX_TEST_MINUTES = 120;

export async function getTestMinutes(): Promise<number> {
  const s = await db.setting.findUnique({ where: { key: "test_duration_min" } });
  const n = Number(s?.value);
  return Number.isInteger(n) && n >= MIN_TEST_MINUTES && n <= MAX_TEST_MINUTES ? n : DEFAULT_TEST_MINUTES;
}
