import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usageLimit } from "@/lib/assistant";
import { requireAdmin } from "@/lib/session";
import { getUserLimit } from "@/lib/testSettings";

// Список сотрудников для админ-панели (выгрузка по одному сотруднику, просмотр кабинета).
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const rows = await db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, username: true, role: true, createdAt: true, leaderboard: true,
      premium: true, premiumFrom: true, premiumUntil: true, premiumLimit: true, premiumLimitPeriod: true,
    },
  });
  // premiumUsed — сколько ответов помощника уже получено в текущем периоде лимита.
  const users = await Promise.all(
    rows.map(async (u) => ({ ...u, premiumUsed: u.premium && u.premiumLimit !== null ? (await usageLimit(u))?.used ?? 0 : null }))
  );
  // limit — максимум пользователей (0 — без ограничений); считаются все, кроме суперадминистратора.
  return NextResponse.json({ users, limit: await getUserLimit(), counted: users.filter((u) => u.role !== "SUPERADMIN").length });
}
