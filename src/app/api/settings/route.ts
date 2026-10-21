import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";
import { isValidOpenMinutes, isValidQuestionCount, MAX_QUESTION_COUNT, MAX_TEST_MINUTES, MIN_TEST_MINUTES } from "@/lib/testSettings";

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
      return NextResponse.json({ error: "Время теста — целое число минут, не меньше 1" }, { status: 400 });
    }
  }
  if (key === "test_question_count" && !isValidQuestionCount(Number(value))) {
    return NextResponse.json({ error: `Вопросов в тесте — целое число от 1 до ${MAX_QUESTION_COUNT}` }, { status: 400 });
  }
  if (String(key).startsWith("open_question_min_") && !isValidOpenMinutes(Number(String(value).replace(",", ".")))) {
    return NextResponse.json({ error: "Время на открытый вопрос — от 0,25 до 60 минут (можно дробно, например 1.5)" }, { status: 400 });
  }
  if (key === "test_attempt_limit") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return NextResponse.json({ error: "Попыток — целое число, 0 — без ограничений" }, { status: 400 });
  }
  const stored = String(key).startsWith("open_question_min_") ? String(value).replace(",", ".") : value;
  const setting = await db.setting.upsert({
    where: { key },
    create: { key, value: stored },
    update: { value: stored },
  });
  return NextResponse.json({ setting });
}
