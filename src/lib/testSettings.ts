import { db } from "./db";
import { LEVELS, OPEN_QUESTION_SECONDS, type LevelId } from "./levels";
import { GAME_TIMER_DEFAULTS, type GameTimerKind } from "./gameConstants";

// Время на тест, вопросы и попытки настраиваются в админ-панели для каждого уровня (см. getLevelSettings).
export const DEFAULT_TEST_MINUTES = 15;
export const MIN_TEST_MINUTES = 1;
// Любое число минут; верхняя граница (неделя) только защищает от опечатки.
export const MAX_TEST_MINUTES = 10080;

// Сколько вопросов в одном тесте — любое число,
// верхняя граница только защищает от опечатки вроде 10000.
export const DEFAULT_QUESTION_COUNT = 10;
export const MIN_QUESTION_COUNT = 1;
export const MAX_QUESTION_COUNT = 500;

export const isValidQuestionCount = (n: number) => Number.isInteger(n) && n >= MIN_QUESTION_COUNT && n <= MAX_QUESTION_COUNT;

// Настройки теста по каждому уровню: сколько вопросов, минут на тест и попыток (0 — без ограничений).
// Ключи Setting: test_question_count_<УРОВЕНЬ>, test_duration_min_<УРОВЕНЬ>, test_attempt_limit_<УРОВЕНЬ>.
// Если для уровня не задано — берётся прежняя общая настройка (test_question_count и т.д.), затем значение по умолчанию.
export type LevelTestSettings = { count: number; minutes: number; attempts: number };
export const LEVEL_SETTING_KEYS = { count: "test_question_count", minutes: "test_duration_min", attempts: "test_attempt_limit" } as const;
export const isValidTestMinutes = (n: number) => Number.isInteger(n) && n >= MIN_TEST_MINUTES && n <= MAX_TEST_MINUTES;
export const isValidAttemptLimit = (n: number) => Number.isInteger(n) && n >= 0;

export async function getLevelSettings(): Promise<Record<LevelId, LevelTestSettings>> {
  const base = Object.values(LEVEL_SETTING_KEYS);
  const keys = [...base, ...LEVELS.flatMap((l) => base.map((k) => `${k}_${l.id}`))];
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const read = (key: string, level: LevelId, valid: (n: number) => boolean, fallback: number) => {
    for (const k of [`${key}_${level}`, key]) {
      const v = rows.find((r) => r.key === k)?.value;
      if (v !== undefined && valid(Number(v))) return Number(v);
    }
    return fallback;
  };
  return Object.fromEntries(
    LEVELS.map((l) => [
      l.id,
      {
        count: read(LEVEL_SETTING_KEYS.count, l.id, isValidQuestionCount, DEFAULT_QUESTION_COUNT),
        minutes: read(LEVEL_SETTING_KEYS.minutes, l.id, isValidTestMinutes, DEFAULT_TEST_MINUTES),
        attempts: read(LEVEL_SETTING_KEYS.attempts, l.id, isValidAttemptLimit, 0),
      },
    ])
  ) as Record<LevelId, LevelTestSettings>;
}

// Сколько попыток по каждому уровню осталось у сотрудника (null — без ограничений на этом уровне).
// Возвращает null целиком, если лимитов нет совсем или это администратор.
export async function attemptsLeft(user: { id: string; role: string }): Promise<Record<string, number | null> | null> {
  const settings = await getLevelSettings();
  if (user.role !== "EMPLOYEE" || LEVELS.every((l) => !settings[l.id].attempts)) return null;
  const u = await db.user.findUnique({ where: { id: user.id }, select: { attemptsResetAt: true } });
  const used = await db.testAttempt.groupBy({
    by: ["level"],
    where: { userId: user.id, ...(u?.attemptsResetAt ? { startedAt: { gt: u.attemptsResetAt } } : {}) },
    _count: { _all: true },
  });
  const left: Record<string, number | null> = {};
  for (const l of LEVELS) {
    const limit = settings[l.id].attempts;
    const n = used.find((x) => x.level === l.id)?._count._all ?? 0;
    left[l.id] = limit ? Math.max(0, limit - n) : null;
  }
  return left;
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

// Максимум пользователей сайта (кроме суперадминистратора), Setting "max_users". 0 — без ограничений.
// Когда лимит достигнут, новая регистрация закрыта; уже созданные аккаунты работают.
export async function getUserLimit(): Promise<number> {
  const s = await db.setting.findUnique({ where: { key: "max_users" } });
  const n = Number(s?.value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// Таймеры в обучающих играх, секунды на один ответ (Setting "game_seconds_<ИГРА>").
export const isValidGameSeconds = (n: number) => Number.isInteger(n) && n >= 3 && n <= 3600;
export async function getGameTimers(): Promise<Record<GameTimerKind, number>> {
  const kinds = Object.keys(GAME_TIMER_DEFAULTS) as GameTimerKind[];
  const rows = await db.setting.findMany({ where: { key: { in: kinds.map((k) => `game_seconds_${k}`) } } });
  const result: Record<GameTimerKind, number> = { ...GAME_TIMER_DEFAULTS };
  for (const k of kinds) {
    const n = Number(rows.find((r) => r.key === `game_seconds_${k}`)?.value);
    if (isValidGameSeconds(n)) result[k] = n;
  }
  return result;
}
