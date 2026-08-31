import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiProvider } from "@/lib/ai";
import { gradeByKeywords } from "@/lib/grading/keywordGrader";
import { features } from "@/lib/config/features";

// Раздел 5, 7 запроса: проверка открытых ответов строго на основе загруженных
// материалов. Вопрос, связанное правило и материал берутся из БД по questionId
// (не из тела запроса от браузера) — надёжнее и гарантирует проверку по
// актуальному источнику. Если у вопроса есть привязанное правило (Rule) —
// оно добавляется отдельным явным контекстом поверх текста всего документа,
// чтобы ИИ ссылался на конкретное правило, а не искал его в тексте заново.
export async function POST(req: NextRequest) {
  const { attemptId, questionId, answerText } = await req.json();

  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { sourceMaterial: true, rule: true },
  });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const expectedKeywords = (question.expectedKeywords as string[] | null) ?? [];
  let materialContext = question.sourceMaterial?.content ?? null;

  if (question.rule) {
    const ruleBlock = `[Конкретное правило, которое проверяет этот вопрос — тип: ${question.rule.type}]\n${question.rule.text}${question.rule.sourceQuote ? `\n(источник: "${question.rule.sourceQuote}")` : ""}\n\n`;
    materialContext = ruleBlock + (materialContext ?? "");
  }

  const result =
    features.GRADING_MODE === "ai"
      ? await aiProvider.gradeOpenAnswer(question.text, expectedKeywords, answerText ?? "", materialContext)
      : gradeByKeywords(expectedKeywords, answerText ?? "");

  const answer = await db.answer.create({
    data: {
      attemptId,
      questionId,
      rawAnswer: answerText,
      isCorrect: result.correct,
      spellingErrors: result.spellingErrors,
      grammarErrors: result.grammarErrors,
      aiComment: result.comment,
    },
  });

  return NextResponse.json({ answer, result });
}
