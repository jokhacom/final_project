import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// Список сотрудников для админ-панели (выгрузка по одному сотруднику, просмотр кабинета).
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, username: true, role: true, createdAt: true, leaderboard: true },
  });
  return NextResponse.json({ users });
}
