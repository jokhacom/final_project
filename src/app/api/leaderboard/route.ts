import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const entries = await db.leaderboardEntry.findMany({
    include: { user: true },
    orderBy: { bestCandy: "desc" },
    take: 50,
  });

  const rows = entries.map((e, i) => ({
    place: i + 1,
    name: e.user.name,
    candies: Math.round(e.bestCandy),
    avg: Math.round(e.avgCandy),
    tests: e.testsDone,
  }));

  return NextResponse.json({ rows });
}
