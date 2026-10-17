import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const entries = await db.leaderboardEntry.findMany({
    include: { user: { select: { name: true } } },
    orderBy: [{ bestCandy: "desc" }, { avgCandy: "desc" }],
    take: 50,
  });

  const rows = entries.map((e, i) => ({
    place: i + 1,
    name: e.user.name,
    candies: Math.round(e.bestCandy),
    avg: Math.round(e.avgCandy),
    tests: e.testsDone,
    isMe: e.userId === user.id,
  }));

  return NextResponse.json({ rows });
}
