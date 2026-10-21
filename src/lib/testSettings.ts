import { db } from "./db";
import { LEVELS, OPEN_QUESTION_SECONDS, type LevelId } from "./levels";

// Время на тест настраивается в админ-панели (Setting "test_duration_min").
export const DEFAULT_TEST_MINUTES = 15;
export const MIN_TEST_MINUTES = 1;
// Любое число минут; верхняя граница (неделя) только защищает от опечатки.
export const MAX_TEST_MINUTES = 10080;

// Сколько вопросов в одном тесте (Setting "test_question_count") — любое число,
// верхняя граница только защищает от опечатки вроде 10000.
export const DEFAULT_QUESTION_COUNT = 10;
export const MIN_QUESTION_COUNT = 1;
export const MAX_QUESTION_COUNT = 500;

export const isValidQuestionCount = (n: number) => Number.isInteger(n) && n >= MIN_QUESTION_COUNT && n <= MAX_QUESTION_COUNT;

export async function getQuestionCount(): Promise<number> {
  const s = await db.setting.findUnique({ where: { key: "test_question_count" } });
  const n = Number(s?.value);
  return isValidQuestionCount(n) ? n : DEFAULT_QUESTION_COUNT;
}

// Сколько раз сотрудник может пройти каждый уровень (Setting "test_attempt_limit").
// 0 — без ограничений. Администраторов лимит не касается.
export async function getAttemptLimit(): Promise<number> {
  const s = await db.setting.findUnique({ where: { key: "test_attempt_limit" } });
  const n = Number(s?.value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// Сколько попыток по каждому уровню осталось у сотрудника (null — без ограничений).
export async function attemptsLeft(user: { id: string; role: string }): Promise<Record<string, number> | null> {
  const limit = await getAttemptLimit();
  if (!limit || user.role !== "EMPLOYEE") return null;
  const u = await db.user.findUnique({ where: { id: user.id }, select: { attemptsResetAt: true } });
  const used = await db.testAttempt.groupBy({
    by: ["level"],
    where: { userId: user.id, ...(u?.attemptsResetAt ? { startedAt: { gt: u.attemptsResetAt } } : {}) },
    _count: { _all: true },
  });
  const left: Record<string, number> = {};
  for (const level of ["BEGINNER", "MIDDLE", "PROFESSIONAL", "EXAM"]) {
    const n = used.find((x) => x.level === level)?._count._all ?? 0;
    left[level] = Math.max(0, limit - n);
  }
  return left;
}

export async function getTestMinutes(): Promise<number> {
  const s = await db.setting.findUnique({ where: { key: "test_duration_min" } });
  const n = Number(s?.value);
  return Number.isInteger(n) && n >= MIN_TEST_MINUTES && n <= MAX_TEST_MINUTES ? n : DEFAULT_TEST_MINUTES;
}

// Время на один открытый вопрос по уровням, в секундах. В настройке хранится в минутах (можно дробно: 1.5).
export const openQuestionKey = (level: LevelId) => `open_question_min_${level}`;
export const isValidOpenMinutes = (n: number) => Number.isFinite(n) && n >= 0.25 && n <= 60;
export async function getOpenSeconds(): Promise<Record<LevelId, number>> {
  const rows = await db.setting.findMany({ where: { key: { in: LEVELS.map((l) => openQuestionKey(l.id)) } } });
  const result = { ...OPEN_QUESTION_SECONDS };
  for (const l of LEVELS) {
    const n = Number(rows.find((r) => r.key === openQuestionKey(l.id))?.value);
    if (isValidOpenMinutes(n)) result[l.id] = Math.round(n * 60);
  }
  return result;
}
