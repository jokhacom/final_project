import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateCandies, resultLevel } from "@/lib/scoring";
import { checkNewAchievements } from "@/lib/achievements";

export async function POST(req: NextRequest) {
  const { attemptId } = await req.json();

  const attempt = await db.testAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: { include: { question: true } } },
  });
  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

  // Раздел 11: начисление конфет
  const candies = calculateCandies(attempt.answers);
  const { label, comment } = resultLevel(candies);

  await db.testAttempt.update({
    where: { id: attemptId },
    data: { candies, finishedAt: new Date() },
  });

  // Раздел 14: запоминаем ошибки — сохраняем тему (текст вопроса) как "слабую тему"
  const wrong = attempt.answers.filter((a) => !a.isCorrect);
  if (wrong.length > 0) {
    await db.weakTopic.createMany({
      data: wrong.map((a) => ({ userId: attempt.userId, topic: a.question.text })),
    });
  }

  // Раздел 16: обновляем рейтинг
  const allAttempts = await db.testAttempt.findMany({
    where: { userId: attempt.userId, finishedAt: { not: null } },
  });
  const avgCandy = allAttempts.reduce((sum, a) => sum + a.candies, 0) / allAttempts.length;
  const bestCandy = Math.max(...allAttempts.map((a) => a.candies));

  await db.leaderboardEntry.upsert({
    where: { userId: attempt.userId },
    create: { userId: attempt.userId, testsDone: allAttempts.length, avgCandy, bestCandy },
    update: { testsDone: allAttempts.length, avgCandy, bestCandy },
  });

  // Раздел 13: достижения
  const existing = await db.userAchievement.findMany({ where: { userId: attempt.userId } });
  const history = allAttempts.map((a) => ({ candies: a.candies, level: a.level }));
  const newly = checkNewAchievements(
    history,
    existing.map((e) => e.achievementId)
  );
  if (newly.length > 0) {
    await db.userAchievement.createMany({
      data: newly.map((a) => ({ userId: attempt.userId, achievementId: a.id })),
    });
  }

  // Раздел 21: право на сертификат
  const certificateEligible = candies > 90;

  return NextResponse.json({
    candies,
    resultLabel: label,
    aiComment: comment,
    newAchievements: newly.map((a) => ({ id: a.id, label: a.label, icon: a.icon })),
    certificateEligible,
  });
}
