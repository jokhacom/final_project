import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiProvider } from "@/lib/ai";
import { gradeByKeywords } from "@/lib/grading/keywordGrader";
import { features } from "@/lib/config/features";
import { requireUser } from "@/lib/session";
import { answerBlocker } from "@/lib/attempts";

// Проверка ответов своими словами (OPEN, FIND_ERROR, FIX_MESSAGE) строго по
// загруженным материалам. Вопрос, правило и материал берутся из БД по questionId.
// Если у вопроса есть правило — оно идёт отдельным явным блоком поверх текста
// документа. Если ИИ недоступен — запасная проверка по ключевым словам.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { attemptId, questionId, answerText } = await req.json();
  const blocker = await answerBlocker(attemptId, user.id, questionId);
  if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });

  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { sourceMaterial: true, rule: true },
  });
  if (!question) return NextResponse.json({ error: "Вопрос не найден" }, { status: 404 });

  const answer = String(answerText ?? "").slice(0, 4000);
  const expectedKeywords = (question.expectedKeywords as string[] | null) ?? [];
  let materialContext = question.sourceMaterial?.content ?? null;
  if (question.rule) {
    const ruleBlock = `[Конкретное правило, которое проверяет этот вопрос — тип: ${question.rule.type}]\n${question.rule.text}${question.rule.sourceQuote ? `\n(источник: "${question.rule.sourceQuote}")` : ""}\n\n`;
    materialContext = ruleBlock + (materialContext ?? "");
  }

  let result;
  if (!answer.trim()) {
    result = { correct: false, spellingErrors: 0, grammarErrors: 0, comment: "Ответ не был написан." };
  } else if (features.GRADING_MODE === "ai") {
    try {
      result = await aiProvider.gradeOpenAnswer(question.text, expectedKeywords, answer, materialContext);
    } catch (e) {
      console.error("AI grading failed, falling back to keywords:", e);
      result = gradeByKeywords(expectedKeywords, answer);
    }
  } else {
    result = gradeByKeywords(expectedKeywords, answer);
  }

  await db.answer.create({
    data: {
      attemptId,
      questionId,
      rawAnswer: answer,
      isCorrect: result.correct,
      spellingErrors: result.spellingErrors,
      grammarErrors: result.grammarErrors,
      aiComment: result.comment,
    },
  });

  return NextResponse.json({ ok: true });
}
