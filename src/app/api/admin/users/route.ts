import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getUserLimit } from "@/lib/testSettings";

// Список сотрудников для админ-панели (выгрузка по одному сотруднику, просмотр кабинета).
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, username: true, role: true, premium: true, createdAt: true, leaderboard: true },
  });
  // limit — максимум пользователей (0 — без ограничений); считаются все, кроме суперадминистратора.
  return NextResponse.json({ users, limit: await getUserLimit(), counted: users.filter((u) => u.role !== "SUPERADMIN").length });
}
