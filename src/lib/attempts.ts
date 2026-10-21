import { db } from "./db";
import { isChoiceType } from "./ai/provider";
import { calculateCandies, resultLevel } from "./scoring";
import { achievementById, checkNewAchievements } from "./achievements";
import { TEST_GRACE_SEC } from "./levels";
import { gradePendingAnswers } from "./grading/gradeOpen";

export const attemptQuestionIds = (a: { questionIds: unknown }) => (Array.isArray(a.questionIds) ? (a.questionIds as string[]) : []);

export function isExpired(a: { startedAt: Date; durationSec: number }) {
  return Date.now() > a.startedAt.getTime() + (a.durationSec + TEST_GRACE_SEC) * 1000;
}

// Можно ли сейчас принять (или изменить) ответ на вопрос в этой попытке. Возвращает текст ошибки или null.
// До завершения теста ответ можно менять: сотрудник ходит по вопросам стрелками «назад/вперёд».
export async function answerBlocker(attemptId: string, userId: string, questionId: string): Promise<string | null> {
  const attempt = await db.testAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId) return "Попытка не найдена";
  if (attempt.finishedAt) return "Тест уже завершён";
  if (isExpired(attempt)) return "Время теста истекло";
  if (!attemptQuestionIds(attempt).includes(questionId)) return "Этого вопроса нет в вашем тесте";
  return null;
}

// Сохранить ответ: первый раз — создать, повторно — заменить прежний.
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  data: { rawAnswer: string; isCorrect: boolean; needsGrading?: boolean }
) {
  const existing = await db.answer.findFirst({ where: { attemptId, questionId }, select: { id: true } });
  if (existing) await db.answer.update({ where: { id: existing.id }, data: { ...data, aiComment: null } });
  else await db.answer.create({ data: { attemptId, questionId, ...data } });
}

// Сколько секунд осталось на открытый вопрос (null — вопрос ещё не открывали).
// limitSec — время на открытый вопрос этого уровня (getOpenSeconds в testSettings.ts).
type OpenTimed = { openStarts: unknown };
export const openStartsOf = (a: OpenTimed) => (a.openStarts && typeof a.openStarts === "object" ? (a.openStarts as Record<string, string>) : {});
export function openSecondsLeft(a: OpenTimed, questionId: string, limitSec: number, grace = 0): number | null {
  const start = openStartsOf(a)[questionId];
  if (!start) return null;
  return Math.round((new Date(start).getTime() + (limitSec + grace) * 1000 - Date.now()) / 1000);
}

// Тест ещё идёт: не завершён и время не вышло (без запаса на сеть — он только для приёма ответов).
export function isRunning(a: { startedAt: Date; durationSec: number; finishedAt: Date | null }) {
  return !a.finishedAt && Date.now() < a.startedAt.getTime() + a.durationSec * 1000;
}

// Полный разбор попытки: по каждому вопросу — ответ сотрудника, верный ответ и пояснение.
export async function buildResult(attemptId: string) {
  const attempt = await db.testAttempt.findUnique({
    where: { id: attemptId },
    include: { user: true, answers: { include: { question: { include: { rule: true } } } } },
  });
  if (!attempt) return null;

  const order = attemptQuestionIds(attempt);
  const answers = [...attempt.answers].sort((a, b) => order.indexOf(a.questionId) - order.indexOf(b.questionId));
  const { label, comment } = resultLevel(attempt.candies);

  const review = answers.map((a, i) => {
    const q = a.question;
    const options = (q.options as string[] | null) ?? null;
    const choice = isChoiceType(q.type);
    const selected = choice && a.rawAnswer != null && a.rawAnswer !== "" ? Number(a.rawAnswer) : null;
    return {
      n: i + 1,
      questionId: q.id,
      type: q.type,
      text: q.text,
      options,
      selectedIndex: selected,
      correctIndex: choice ? q.correctIndex : null,
      userAnswer: choice ? (selected != null && options ? options[selected] ?? null : null) : a.rawAnswer,
      correctAnswer: choice
        ? options?.[q.correctIndex ?? -1] ?? null
        : q.modelAnswer || ((q.expectedKeywords as string[] | null) ?? []).join(", ") || null,
      correctAnswerIsModel: !choice && !!q.modelAnswer,
      image: q.image,
      isCorrect: a.isCorrect,
      spellingErrors: a.spellingErrors,
      grammarErrors: a.grammarErrors,
      comment: a.aiComment,
      explanation: q.explanation,
      rule: q.rule?.text ?? null,
      unanswered: a.rawAnswer == null,
      reviewed: !!a.reviewedAt,
    };
  });

  return {
    attemptId: attempt.id,
    userName: attempt.user.name,
    level: attempt.level,
    candies: attempt.candies,
    finished: !!attempt.finishedAt,
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    resultLabel: label,
    resultComment: comment,
    certificateEligible: attempt.candies > 90,
    correctCount: review.filter((r) => r.isCorrect).length,
    total: review.length,
    review,
  };
}

// Завершение попытки: неотвеченные вопросы считаются неверными, затем
// начисляем конфеты, слабые темы, рейтинг и достижения. Повторный вызов безопасен.
export async function finishAttempt(attemptId: string) {
  const attempt = await db.testAttempt.findUnique({ where: { id: attemptId }, include: { answers: true } });
  if (!attempt) return null;
  if (attempt.finishedAt) return { newAchievements: [] as { id: string; label: string; icon: string }[] };

  const answered = new Set(attempt.answers.map((a) => a.questionId));
  const missing = attemptQuestionIds(attempt).filter((id) => !answered.has(id));
  if (missing.length) {
    await db.answer.createMany({
      data: missing.map((questionId) => ({
        attemptId,
        questionId,
        rawAnswer: null,
        isCorrect: false,
        aiComment: "Нет ответа — время вышло или вопрос пропущен.",
      })),
    });
  }

  // Открытые ответы проверяются здесь, все разом.
  await gradePendingAnswers(attemptId);

  const answers = await db.answer.findMany({ where: { attemptId }, include: { question: { include: { topic: true } } } });
  const candies = calculateCandies(answers);

  // updateMany с условием finishedAt = null защищает от двойного начисления при параллельных запросах.
  const { count } = await db.testAttempt.updateMany({
    where: { id: attemptId, finishedAt: null },
    data: { candies, finishedAt: new Date() },
  });
  if (count === 0) return { newAchievements: [] };

  const userId = attempt.userId;

  const wrong = answers.filter((a) => !a.isCorrect);
  if (wrong.length) {
    await db.weakTopic.createMany({
      data: wrong.map((a) => ({ userId, topic: a.question.topic?.name ?? a.question.text.slice(0, 200) })),
    });
  }

  const newly = await refreshUserStats(userId);
  return { newAchievements: newly.map((a) => ({ id: a.id, label: a.label, icon: a.icon })) };
}

// Пересчитать рейтинг и выдать новые достижения сотрудника — после завершения
// теста и после ручной проверки ответа администратором.
export async function refreshUserStats(userId: string) {
  const allAttempts = await db.testAttempt.findMany({ where: { userId, finishedAt: { not: null } } });
  if (!allAttempts.length) return [];
  const avgCandy = allAttempts.reduce((sum, a) => sum + a.candies, 0) / allAttempts.length;
  const bestCandy = Math.max(...allAttempts.map((a) => a.candies));
  await db.leaderboardEntry.upsert({
    where: { userId },
    create: { userId, testsDone: allAttempts.length, avgCandy, bestCandy },
    update: { testsDone: allAttempts.length, avgCandy, bestCandy },
  });

  const [existing, correctAnswers] = await Promise.all([
    db.userAchievement.findMany({ where: { userId } }),
    db.answer.count({ where: { isCorrect: true, attempt: { userId } } }),
  ]);
  const newly = checkNewAchievements(
    { history: allAttempts.map((a) => ({ candies: a.candies, level: a.level })), correctAnswers },
    existing.map((e) => e.achievementId)
  );
  if (newly.length) {
    await db.userAchievement.createMany({
      data: newly.map((a) => ({ userId, achievementId: a.id })),
      skipDuplicates: true,
    });
  }
  return newly;
}

// Ручная проверка ответа администратором: меняем оценку ответа и пересчитываем
// конфеты попытки, рейтинг и достижения сотрудника.
export async function reviewAnswer(
  answerId: string,
  reviewerId: string,
  r: { isCorrect: boolean; spellingErrors: number; grammarErrors: number; comment: string | null }
) {
  const answer = await db.answer.update({
    where: { id: answerId },
    data: {
      isCorrect: r.isCorrect,
      spellingErrors: r.spellingErrors,
      grammarErrors: r.grammarErrors,
      aiComment: r.comment,
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
    },
    include: { attempt: true },
  });
  const all = await db.answer.findMany({ where: { attemptId: answer.attemptId } });
  const candies = calculateCandies(all);
  await db.testAttempt.update({ where: { id: answer.attemptId }, data: { candies } });
  if (answer.attempt.finishedAt) await refreshUserStats(answer.attempt.userId);
  return { candies };
}

export function achievementView(achievementId: string, earnedAt: Date) {
  const def = achievementById(achievementId);
  return { id: achievementId, label: def?.label ?? achievementId, icon: def?.icon ?? "🏅", description: def?.description ?? "", earnedAt };
}
