import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { levelReadiness } from "@/lib/readiness";
import { db } from "@/lib/db";
import { isRunning } from "@/lib/attempts";
import { attemptsLeft, getOpenSeconds, getQuestionCount, getTestMinutes } from "@/lib/testSettings";

// Какие уровни уже можно проходить (для карточек на странице выбора уровня).
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const [levels, minutes, count, left, unfinished, openSeconds] = await Promise.all([
    levelReadiness(),
    getTestMinutes(),
    getQuestionCount(),
    attemptsLeft(user),
    db.testAttempt.findMany({ where: { userId: user.id, finishedAt: null }, select: { level: true, startedAt: true, durationSec: true, finishedAt: true } }),
    getOpenSeconds(),
  ]);
  // Начатый тест, время которого ещё идёт, — на карточке «Продолжить тест».
  const running = new Set(unfinished.filter(isRunning).map((a) => a.level));
  return NextResponse.json({
    minutes,
    count,
    openSeconds,
    levels: levels.map((l) => ({ id: l.id, ready: l.ready, inTest: l.inTest, attemptsLeft: left ? left[l.id] : null, inProgress: running.has(l.id) })),
  });
}
