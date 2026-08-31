import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function sample<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// Раздел 8: Beginner / Middle / Professional — 10 вопросов (5 MC + 5 открытых) каждого уровня.
// Раздел 9: Итоговый экзамен — 3 Beginner + 3 Middle + 4 Professional, тоже 5 MC + 5 открытых.
export async function POST(req: NextRequest) {
  const { userId, level } = await req.json(); // level: BEGINNER | MIDDLE | PROFESSIONAL | EXAM

  let questionIds: string[] = [];

  if (level === "EXAM") {
    const [beginner, middle, professional] = await Promise.all([
      db.question.findMany({ where: { level: "BEGINNER" } }),
      db.question.findMany({ where: { level: "MIDDLE" } }),
      db.question.findMany({ where: { level: "PROFESSIONAL" } }),
    ]);

    const beginnerMc = sample(beginner.filter((q) => q.type === "MULTIPLE_CHOICE"), 1);
    const beginnerOpen = sample(beginner.filter((q) => q.type === "OPEN"), 2);
    const middleMc = sample(middle.filter((q) => q.type === "MULTIPLE_CHOICE"), 2);
    const middleOpen = sample(middle.filter((q) => q.type === "OPEN"), 1);
    const proMc = sample(professional.filter((q) => q.type === "MULTIPLE_CHOICE"), 2);
    const proOpen = sample(professional.filter((q) => q.type === "OPEN"), 2);

    questionIds = [...beginnerMc, ...beginnerOpen, ...middleMc, ...middleOpen, ...proMc, ...proOpen].map((q) => q.id);
  } else {
    const pool = await db.question.findMany({ where: { level } });
    const mc = sample(pool.filter((q) => q.type === "MULTIPLE_CHOICE"), 5);
    const open = sample(pool.filter((q) => q.type === "OPEN"), 5);
    questionIds = [...mc, ...open].map((q) => q.id);
  }

  if (questionIds.length < 10) {
    return NextResponse.json(
      { error: "Недостаточно вопросов для этого уровня — загрузите больше материалов и сгенерируйте вопросы" },
      { status: 422 }
    );
  }

  const attempt = await db.testAttempt.create({
    data: { userId, level, candies: 0 },
  });

  const questions = await db.question.findMany({ where: { id: { in: questionIds } } });

  return NextResponse.json({ attemptId: attempt.id, questions });
}
