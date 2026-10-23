import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { levelReadiness } from "@/lib/readiness";
import { db } from "@/lib/db";
import { isRunning } from "@/lib/attempts";
import { attemptsLeft, getLevelSettings, getOpenSeconds } from "@/lib/testSettings";

// Какие уровни уже можно проходить (для карточек на странице выбора уровня).
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const [levels, settings, left, unfinished, openSeconds] = await Promise.all([
    levelReadiness(),
    getLevelSettings(),
    attemptsLeft(user),
    db.testAttempt.findMany({ where: { userId: user.id, finishedAt: null }, select: { level: true, startedAt: true, durationSec: true, finishedAt: true } }),
    getOpenSeconds(),
  ]);
  // Начатый тест, время которого ещё идёт, — на карточке «Продолжить тест».
  const running = new Set(unfinished.filter(isRunning).map((a) => a.level));
  return NextResponse.json({
    openSeconds,
    levels: levels.map((l) => ({
      id: l.id,
      ready: l.ready,
      inTest: l.inTest,
      minutes: settings[l.id].minutes,
      count: settings[l.id].count,
      attemptsLeft: left ? left[l.id] : null,
      inProgress: running.has(l.id),
    })),
  });
}
