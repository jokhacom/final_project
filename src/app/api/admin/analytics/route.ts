import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, requireSuperadmin } from "@/lib/session";
import { buildAnalytics, parseDays } from "@/lib/analytics";

// Аналитика за период: ?days=7|30|90|0 (0 — за всё время).
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  return NextResponse.json(await buildAnalytics(parseDays(req.nextUrl.searchParams.get("days"))));
}

// Удалить результаты (попытки) вместе с ответами: { ids: [...] }. Только суперадмин.
// Удалённые попытки больше не считаются в рейтинге, аналитике и лимите попыток.
export async function DELETE(req: NextRequest) {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;

  const { ids } = await req.json();
  if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ error: "Нужны ids" }, { status: 400 });
  const list = ids.map(String);
  const [, removed] = await db.$transaction([
    db.answer.deleteMany({ where: { attemptId: { in: list } } }),
    db.testAttempt.deleteMany({ where: { id: { in: list } } }),
  ]);
  return NextResponse.json({ deleted: removed.count });
}
