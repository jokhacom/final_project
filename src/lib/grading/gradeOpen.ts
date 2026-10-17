import { db } from "../db";
import { aiProvider } from "../ai";
import { features } from "../config/features";
import { gradeByKeywords } from "./keywordGrader";
import type { GradeResult } from "../ai/provider";

// Проверка ответа своими словами (OPEN, FIND_ERROR, FIX_MESSAGE) строго по
// загруженным материалам. Если у вопроса есть правило/тема — они идут явным
// контекстом. Если ИИ недоступен — запасная проверка по ключевым словам.
export async function gradeOpenAnswerFor(questionId: string, answer: string): Promise<GradeResult> {
  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { sourceMaterial: true, rule: true, topic: { include: { rules: true } } },
  });
  if (!question) return { correct: false, spellingErrors: 0, grammarErrors: 0, comment: "Вопрос удалён." };
  if (!answer.trim()) return { correct: false, spellingErrors: 0, grammarErrors: 0, comment: "Ответ не был написан." };

  const expectedKeywords = (question.expectedKeywords as string[] | null) ?? [];
  // Если вопрос привязан к теме — даём ИИ все правила этой темы: они точно относятся
  // к вопросу, даже если документ большой (книга). Иначе — начало текста документа.
  let materialContext = question.topic
    ? `[Тема «${question.topic.name}» — правила из документа]\n` +
      question.topic.rules.map((r) => `- [${r.type}] ${r.text}${r.sourceQuote ? ` (источник: "${r.sourceQuote}")` : ""}`).join("\n")
    : question.sourceMaterial?.content ?? null;
  if (question.modelAnswer) {
    materialContext = `[Эталонный ответ, который составил администратор]\n${question.modelAnswer}\n\n` + (materialContext ?? "");
  }
  if (question.rule) {
    const ruleBlock = `[Конкретное правило, которое проверяет этот вопрос — тип: ${question.rule.type}]\n${question.rule.text}${question.rule.sourceQuote ? `\n(источник: "${question.rule.sourceQuote}")` : ""}\n\n`;
    materialContext = ruleBlock + (materialContext ?? "");
  }

  if (features.GRADING_MODE === "ai") {
    try {
      return await aiProvider.gradeOpenAnswer(question.text, expectedKeywords, answer, materialContext);
    } catch (e) {
      console.error("AI grading failed, falling back to keywords:", e);
    }
  }
  return gradeByKeywords(expectedKeywords, answer, question.modelAnswer);
}

// Проверить все отложенные открытые ответы попытки — одновременно (по 5 за раз),
// чтобы итог появился за несколько секунд, а не после каждого вопроса.
export async function gradePendingAnswers(attemptId: string) {
  const pending = await db.answer.findMany({ where: { attemptId, needsGrading: true } });
  const CONCURRENCY = 5;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    await Promise.all(
      pending.slice(i, i + CONCURRENCY).map(async (a) => {
        const r = await gradeOpenAnswerFor(a.questionId, a.rawAnswer ?? "");
        await db.answer.update({
          where: { id: a.id },
          data: {
            isCorrect: r.correct,
            spellingErrors: r.spellingErrors,
            grammarErrors: r.grammarErrors,
            aiComment: r.comment,
            needsGrading: false,
          },
        });
      })
    );
  }
}
