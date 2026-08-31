import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Вопрос с вариантом ответа проверяется напрямую (без ИИ) — сравнение с correctIndex.
export async function POST(req: NextRequest) {
  const { attemptId, questionId, selectedIndex } = await req.json();

  const question = await db.question.findUnique({ where: { id: questionId } });
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const isCorrect = selectedIndex === question.correctIndex;

  const answer = await db.answer.create({
    data: {
      attemptId,
      questionId,
      rawAnswer: String(selectedIndex),
      isCorrect,
      spellingErrors: 0,
      grammarErrors: 0,
    },
  });

  return NextResponse.json({ answer, isCorrect });
}
