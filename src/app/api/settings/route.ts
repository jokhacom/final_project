import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";
import { MAX_TEST_MINUTES, MIN_TEST_MINUTES, QUESTION_COUNTS } from "@/lib/testSettings";

// Раздел 23: изменения дизайна/текстов/правил без кода.
// Примеры ключей: "daily_quiz_enabled", "theme_accent_color", "welcome_text".
export async function GET() {
  const settings = await db.setting.findMany();
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;
  const { key, value } = await req.json();
  if (key === "test_duration_min") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < MIN_TEST_MINUTES || n > MAX_TEST_MINUTES) {
      return NextResponse.json({ error: `Время теста — от ${MIN_TEST_MINUTES} до ${MAX_TEST_MINUTES} минут` }, { status: 400 });
    }
  }
  if (key === "test_question_count" && !(QUESTION_COUNTS as readonly number[]).includes(Number(value))) {
    return NextResponse.json({ error: `Вопросов в тесте: ${QUESTION_COUNTS.join(", ")}` }, { status: 400 });
  }
  const setting = await db.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  return NextResponse.json({ setting });
}
