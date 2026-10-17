import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// Аналитика: средний уровень команды, статистика по уровням, самые сложные
// вопросы (по доле неверных ответов), частые слабые темы, последние результаты.
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const [attempts, employees, weakTopics, answerStats] = await Promise.all([
    db.testAttempt.findMany({
      where: { finishedAt: { not: null } },
      include: { user: { select: { name: true } } },
      orderBy: { finishedAt: "desc" },
    }),
    db.user.count({ where: { role: "EMPLOYEE" } }),
    db.weakTopic.groupBy({
      by: ["topic"],
      _count: { topic: true },
      orderBy: { _count: { topic: "desc" } },
      take: 10,
    }),
    db.answer.groupBy({ by: ["questionId", "isCorrect"], _count: { _all: true } }),
  ]);

  const avgTeamCandy = attempts.length ? attempts.reduce((s, a) => s + a.candies, 0) / attempts.length : 0;

  const byLevel: Record<string, { count: number; avg: number }> = {};
  for (const a of attempts) {
    byLevel[a.level] ??= { count: 0, avg: 0 };
    byLevel[a.level].count += 1;
    byLevel[a.level].avg += a.candies;
  }
  for (const level of Object.keys(byLevel)) {
    byLevel[level].avg = Math.round(byLevel[level].avg / byLevel[level].count);
  }

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
  const hardestTexts = await db.question.findMany({
    where: { id: { in: hardestIds.map(([id]) => id) } },
    select: { id: true, text: true, level: true },
  });

  return NextResponse.json({
    employees,
    testsDone: attempts.length,
    avgTeamCandy: Math.round(avgTeamCandy),
    byLevel,
    hardestQuestions: hardestIds.map(([id, s]) => {
      const q = hardestTexts.find((t) => t.id === id);
      return { id, text: q?.text ?? "", level: q?.level ?? "", total: s.total, wrongPercent: Math.round((s.wrong / s.total) * 100) };
    }),
    hardestTopics: weakTopics.map((t) => ({ topic: t.topic, count: t._count.topic })),
    recentResults: attempts.slice(0, 30).map((a) => ({
      id: a.id,
      name: a.user.name,
      level: a.level,
      candies: a.candies,
      finishedAt: a.finishedAt,
    })),
  });
}
