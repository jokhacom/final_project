import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { answerBlocker, openSecondsLeft, saveAnswer } from "@/lib/attempts";
import { OPEN_GRACE_SEC, isLevel } from "@/lib/levels";
import { getOpenSeconds } from "@/lib/testSettings";

// Ответ своими словами (OPEN, FIND_ERROR, FIX_MESSAGE) во время теста только
// сохраняется — сотрудник сразу идёт дальше. Проверяются все такие ответы разом
// при завершении теста (см. gradePendingAnswers в lib/grading/gradeOpen.ts).
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { attemptId, questionId, answerText } = await req.json();
  const blocker = await answerBlocker(attemptId, user.id, questionId);
  if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  // У каждого открытого вопроса свой таймер: когда он вышел, ответ больше не меняется.
  const attempt = await db.testAttempt.findUnique({ where: { id: attemptId }, select: { level: true, openStarts: true } });
  const limits = await getOpenSeconds();
  const left = attempt && isLevel(attempt.level) ? openSecondsLeft(attempt, questionId, limits[attempt.level], OPEN_GRACE_SEC) : null;
  if (left !== null && left < 0) return NextResponse.json({ error: "Время на этот вопрос вышло" }, { status: 409 });

  await saveAnswer(attemptId, questionId, {
    rawAnswer: String(answerText ?? "").slice(0, 4000),
    isCorrect: false,
    needsGrading: true,
  });

  return NextResponse.json({ ok: true });
}
