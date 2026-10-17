import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

function sample<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// По умолчанию выключено. Суперадминистратор включает через
// Setting("daily_quiz_enabled", "true") в админ-панели — без изменения кода.
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const setting = await db.setting.findUnique({ where: { key: "daily_quiz_enabled" } });
  if (setting?.value !== "true") {
    return NextResponse.json({ enabled: false, questions: [] });
  }

  const pool = await db.question.findMany({ where: { archivedAt: null }, select: { id: true, type: true, text: true, options: true } });
  return NextResponse.json({ enabled: true, questions: sample(pool, 3) });
}
