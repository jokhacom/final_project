import { db } from "./db";
import { ACHIEVEMENTS } from "./achievements";

// Данные личного кабинета: история, достижения (полученные и нет), слабые темы, место в рейтинге.
export async function getCabinet(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true, role: true, createdAt: true },
  });
  if (!user) return null;

  const [attempts, earned, weak, entry] = await Promise.all([
    db.testAttempt.findMany({
      where: { userId, finishedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      select: { id: true, level: true, candies: true, startedAt: true, finishedAt: true },
    }),
    db.userAchievement.findMany({ where: { userId } }),
    db.weakTopic.groupBy({
      by: ["topic"],
      where: { userId },
      _count: { topic: true },
      orderBy: { _count: { topic: "desc" } },
      take: 8,
    }),
    db.leaderboardEntry.findUnique({ where: { userId } }),
  ]);

  const place = entry ? (await db.leaderboardEntry.count({ where: { bestCandy: { gt: entry.bestCandy } } })) + 1 : null;

  return {
    user,
    stats: {
      testsDone: attempts.length,
      avgCandy: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.candies, 0) / attempts.length) : 0,
      bestCandy: attempts.length ? Math.max(...attempts.map((a) => a.candies)) : 0,
      place,
    },
    attempts,
    achievements: ACHIEVEMENTS.map((a) => {
      const got = earned.find((e) => e.achievementId === a.id);
      return { id: a.id, label: a.label, icon: a.icon, description: a.description, premium: !!a.premium, earnedAt: got?.earnedAt ?? null };
    }),
    weakTopics: weak.map((w) => ({ topic: w.topic, count: w._count.topic })),
  };
}
