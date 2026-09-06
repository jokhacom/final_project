import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [attempts, achievements, weakTopics] = await Promise.all([
    db.testAttempt.findMany({ where: { userId: id }, orderBy: { startedAt: "desc" } }),
    db.userAchievement.findMany({ where: { userId: id } }),
    db.weakTopic.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return NextResponse.json({ user, attempts, achievements, weakTopics });
}
