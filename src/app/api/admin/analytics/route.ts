import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Раздел 18: результаты всех сотрудников, средний уровень команды,
// самые сложные вопросы, частые ошибки, слабые темы, статистика по уровням.
export async function GET() {
  const attempts = await db.testAttempt.findMany({ where: { finishedAt: { not: null } }, include: { user: true } });

  const avgTeamCandy = attempts.length ? attempts.reduce((s, a) => s + a.candies, 0) / attempts.length : 0;

  const byLevel: Record<string, { count: number; avg: number }> = {};
  for (const a of attempts) {
    byLevel[a.level] ??= { count: 0, avg: 0 };
    byLevel[a.level].count += 1;
    byLevel[a.level].avg += a.candies;
  }
  for (const level of Object.keys(byLevel)) {
    byLevel[level].avg = byLevel[level].avg / byLevel[level].count;
  }

  // Самые частые слабые темы = самые сложные вопросы
  const weakTopics = await db.weakTopic.groupBy({
    by: ["topic"],
    _count: { topic: true },
    orderBy: { _count: { topic: "desc" } },
    take: 10,
  });

  const employeeResults = attempts.map((a) => ({ name: a.user.name, level: a.level, candies: a.candies }));

  return NextResponse.json({
    avgTeamCandy: Math.round(avgTeamCandy),
    byLevel,
    hardestTopics: weakTopics.map((t) => ({ topic: t.topic, count: t._count.topic })),
    employeeResults,
  });
}
