import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { attemptQuestionIds, isRunning, openSecondsLeft, openStartsOf } from "@/lib/attempts";

// Сотрудник открыл открытый вопрос: запускаем его отдельный таймер (только в первый раз)
// и возвращаем, сколько секунд на него осталось.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { attemptId, questionId } = await req.json();
  const attempt = await db.testAttempt.findUnique({ where: { id: String(attemptId) } });
  if (!attempt || attempt.userId !== user.id) return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
  if (!isRunning(attempt) || !attemptQuestionIds(attempt).includes(questionId)) {
    return NextResponse.json({ error: "Тест завершён или вопроса нет в тесте" }, { status: 409 });
  }

  let current = attempt;
  if (!openStartsOf(attempt)[questionId]) {
    current = await db.testAttempt.update({
      where: { id: attempt.id },
      data: { openStarts: { ...openStartsOf(attempt), [questionId]: new Date().toISOString() } },
    });
  }
  return NextResponse.json({ secondsLeft: openSecondsLeft(current, questionId) });
}
