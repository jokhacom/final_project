import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { answerBlocker } from "@/lib/attempts";

// Ответ своими словами (OPEN, FIND_ERROR, FIX_MESSAGE) во время теста только
// сохраняется — сотрудник сразу идёт дальше. Проверяются все такие ответы разом
// при завершении теста (см. gradePendingAnswers в lib/grading/gradeOpen.ts).
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { attemptId, questionId, answerText } = await req.json();
  const blocker = await answerBlocker(attemptId, user.id, questionId);
  if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });

  await db.answer.create({
    data: {
      attemptId,
      questionId,
      rawAnswer: String(answerText ?? "").slice(0, 4000),
      isCorrect: false,
      needsGrading: true,
    },
  });

  return NextResponse.json({ ok: true });
}
