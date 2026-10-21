import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { answerBlocker, saveAnswer } from "@/lib/attempts";
import { isChoiceType } from "@/lib/ai/provider";

// Вопрос с вариантами ответа проверяется напрямую (без ИИ) — сравнение с correctIndex.
// Результат сотрудник увидит в разборе после завершения теста.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { attemptId, questionId, selectedIndex } = await req.json();
  const blocker = await answerBlocker(attemptId, user.id, questionId);
  if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });

  const question = await db.question.findUnique({ where: { id: questionId } });
  if (!question || !isChoiceType(question.type)) {
    return NextResponse.json({ error: "Вопрос не найден" }, { status: 404 });
  }

  const index = Number.isInteger(selectedIndex) ? selectedIndex : null;
  await saveAnswer(attemptId, questionId, {
    rawAnswer: index == null ? "" : String(index),
    isCorrect: index != null && index === question.correctIndex,
  });

  return NextResponse.json({ ok: true });
}
