import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { buildResult, finishAttempt } from "@/lib/attempts";

// Завершение теста: неотвеченные вопросы засчитываются как неверные,
// начисляются конфеты, обновляются рейтинг, слабые темы и достижения.
// Ответ содержит полный разбор каждого вопроса.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { attemptId } = await req.json();
  const attempt = await db.testAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== user.id) {
    return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
  }

  const { newAchievements } = (await finishAttempt(attemptId))!;
  const result = await buildResult(attemptId);
  return NextResponse.json({ ...result, newAchievements });
}
