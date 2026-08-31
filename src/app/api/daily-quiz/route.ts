import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function sample<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// Раздел 15: по умолчанию выключено. Суперадминистратор включает через
// Setting("daily_quiz_enabled", "true") в админ-панели — без изменения кода.
export async function GET() {
  const setting = await db.setting.findUnique({ where: { key: "daily_quiz_enabled" } });
  const enabled = setting?.value === "true";

  if (!enabled) {
    return NextResponse.json({ enabled: false, questions: [] });
  }

  const pool = await db.question.findMany();
  const questions = sample(pool, 3);

  return NextResponse.json({ enabled: true, questions });
}
