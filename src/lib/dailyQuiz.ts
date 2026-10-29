import { db } from "./db";
import { activeQuestionsFilter } from "./readiness";

export const DAILY_COUNT = 3;
const CHOICE = ["MULTIPLE_CHOICE", "BEST_RESPONSE"] as const;

// День по Ташкенту: «Вопросы дня» меняются в полночь по местному времени.
export const todayKey = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(d);

// Простой детерминированный хеш: у каждого сотрудника на каждый день свой, но постоянный набор.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export async function isDailyEnabled() {
  const s = await db.setting.findUnique({ where: { key: "daily_quiz_enabled" } });
  return s?.value === "true";
}

// Вопросы дня: только с вариантами ответа и только из тестов (не из архива).
export async function dailyQuestions(userId: string, date: string) {
  const pool = await db.question.findMany({
    where: { type: { in: [...CHOICE] }, ...activeQuestionsFilter },
    select: { id: true, text: true, options: true, correctIndex: true, explanation: true },
  });
  return pool.sort((a, b) => hash(`${userId}:${date}:${a.id}`) - hash(`${userId}:${date}:${b.id}`)).slice(0, DAILY_COUNT);
}

export const answersOf = (r: { answers: unknown } | null) => (r?.answers && typeof r.answers === "object" ? (r.answers as Record<string, boolean>) : {});

// Серия: сколько дней подряд (до сегодня или вчера) пройдены все вопросы дня.
export async function dailyStreak(userId: string, total: number) {
  const rows = await db.dailyQuizResult.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 400, select: { date: true, answers: true } });
  const done = new Set(rows.filter((r) => Object.keys(answersOf(r)).length >= total).map((r) => r.date));
  let streak = 0;
  let day = new Date();
  if (!done.has(todayKey(day))) day = new Date(day.getTime() - 86400000); // сегодня ещё не прошёл — считаем со вчера
  while (done.has(todayKey(day))) {
    streak++;
    day = new Date(day.getTime() - 86400000);
  }
  return streak;
}
