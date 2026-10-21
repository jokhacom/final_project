import { db } from "./db";
import { LEVELS } from "./levels";

// Данные для страницы аналитики и для её выгрузки в Excel — за период (days = 0 — за всё время).
export async function buildAnalytics(days: number) {
  const since = days > 0 ? new Date(Date.now() - days * 24 * 3600 * 1000) : null;
  const finished = { finishedAt: since ? { gte: since } : { not: null } };

  const [attempts, employees, weakTopics, answerStats] = await Promise.all([
    db.testAttempt.findMany({
      where: finished,
      include: { user: { select: { id: true, name: true, username: true } } },
      orderBy: { finishedAt: "desc" },
    }),
    db.user.count({ where: { role: "EMPLOYEE" } }),
    db.weakTopic.groupBy({
      by: ["topic"],
      where: since ? { createdAt: { gte: since } } : {},
      _count: { topic: true },
      orderBy: { _count: { topic: "desc" } },
      take: 10,
    }),
    db.answer.groupBy({ by: ["questionId", "isCorrect"], where: { attempt: finished }, _count: { _all: true } }),
  ]);

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);

  // По дням: сколько тестов и средний результат. Пустые дни — нули, чтобы на графике был ровный шаг.
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const byDay = new Map<string, number[]>();
  for (const a of attempts) {
    const k = dayKey(a.finishedAt!);
    byDay.set(k, [...(byDay.get(k) ?? []), a.candies]);
  }
  const first = attempts.length ? attempts[attempts.length - 1].finishedAt! : new Date();
  const start = since ?? new Date(Math.max(first.getTime(), Date.now() - 365 * 24 * 3600 * 1000));
  const daily: { date: string; tests: number; avg: number | null }[] = [];
  for (let d = new Date(dayKey(start)); d <= new Date(); d = new Date(d.getTime() + 24 * 3600 * 1000)) {
    const xs = byDay.get(dayKey(d)) ?? [];
    daily.push({ date: dayKey(d), tests: xs.length, avg: xs.length ? avg(xs) : null });
  }

  const byLevel = LEVELS.map((l) => {
    const xs = attempts.filter((a) => a.level === l.id).map((a) => a.candies);
    return { level: l.id, label: l.label, tests: xs.length, avg: avg(xs), best: xs.length ? Math.max(...xs) : 0 };
  });

  const people = new Map<string, { userId: string; name: string; username: string; scores: number[]; last: Date }>();
  for (const a of attempts) {
    const p = people.get(a.userId) ?? { userId: a.userId, name: a.user.name, username: a.user.username, scores: [], last: a.finishedAt! };
    p.scores.push(a.candies);
    if (a.finishedAt! > p.last) p.last = a.finishedAt!;
    people.set(a.userId, p);
  }
  const byEmployee = [...people.values()]
    .map((p) => ({ userId: p.userId, name: p.name, username: p.username, tests: p.scores.length, avg: avg(p.scores), best: Math.max(...p.scores), last: p.last }))
    .sort((a, b) => b.avg - a.avg);

  const perQuestion = new Map<string, { total: number; wrong: number }>();
  for (const row of answerStats) {
    const s = perQuestion.get(row.questionId) ?? { total: 0, wrong: 0 };
    s.total += row._count._all;
    if (!row.isCorrect) s.wrong += row._count._all;
    perQuestion.set(row.questionId, s);
  }
  const hardestIds = [...perQuestion.entries()]
    .filter(([, s]) => s.total >= 3)
    .sort((a, b) => b[1].wrong / b[1].total - a[1].wrong / a[1].total)
    .slice(0, 10);
  const hardestTexts = await db.question.findMany({ where: { id: { in: hardestIds.map(([id]) => id) } }, select: { id: true, text: true, level: true } });

  return {
    days,
    employees,
    testsDone: attempts.length,
    avgTeamCandy: avg(attempts.map((a) => a.candies)),
    certificates: attempts.filter((a) => a.candies > 90).length,
    daily,
    byLevel,
    byEmployee,
    hardestQuestions: hardestIds.map(([id, s]) => {
      const q = hardestTexts.find((t) => t.id === id);
      return { id, text: q?.text ?? "", level: q?.level ?? "", total: s.total, wrongPercent: Math.round((s.wrong / s.total) * 100) };
    }),
    hardestTopics: weakTopics.map((t) => ({ topic: t.topic, count: t._count.topic })),
    results: attempts.map((a) => ({ id: a.id, userId: a.userId, name: a.user.name, level: a.level, candies: a.candies, finishedAt: a.finishedAt })),
  };
}

export const parseDays = (v: string | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 3650 ? n : 30;
};
