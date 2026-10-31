import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";
import { isValidAttemptLimit, isValidGameSeconds, isValidOpenMinutes, isValidQuestionCount, isValidTestMinutes, MAX_QUESTION_COUNT } from "@/lib/testSettings";

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
  // Настройки теста — общие (test_duration_min) или для уровня (test_duration_min_BEGINNER).
  const base = String(key).replace(/_(BEGINNER|MIDDLE|PROFESSIONAL|EXAM)$/, "");
  if (base === "test_duration_min" && !isValidTestMinutes(Number(value))) {
    return NextResponse.json({ error: "Время теста — целое число минут, не меньше 1" }, { status: 400 });
  }
  if (base === "test_question_count" && !isValidQuestionCount(Number(value))) {
    return NextResponse.json({ error: `Вопросов в тесте — целое число от 1 до ${MAX_QUESTION_COUNT}` }, { status: 400 });
  }
  if (base === "test_attempt_limit" && !isValidAttemptLimit(Number(value))) {
    return NextResponse.json({ error: "Попыток — целое число, 0 — без ограничений" }, { status: 400 });
  }
  if (key === "max_users") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return NextResponse.json({ error: "Пользователей — целое число, 0 — без ограничений" }, { status: 400 });
  }
  // «Кто проходит обучение» — контекст для ИИ.
  if (key === "ai_work_context" && String(value ?? "").length > 2000) {
    return NextResponse.json({ error: "Описание — не длиннее 2000 символов" }, { status: 400 });
  }
  // Сколько вопросов на тему создаёт ИИ: с вариантами (gen_choice_<УРОВЕНЬ>) и открытых (gen_open_<УРОВЕНЬ>).
  if (/^gen_(choice|open)_(BEGINNER|MIDDLE|PROFESSIONAL|EXAM)$/.test(String(key))) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 30) return NextResponse.json({ error: "Вопросов на тему — целое число от 0 до 30" }, { status: 400 });
  }
  if (String(key).startsWith("game_seconds_") && !isValidGameSeconds(Number(value))) {
    return NextResponse.json({ error: "Время в игре — целое число секунд от 3 до 3600" }, { status: 400 });
  }
  const stored = String(key).startsWith("open_question_min_") ? String(value).replace(",", ".") : value;
  const setting = await db.setting.upsert({
    where: { key },
    create: { key, value: stored },
    update: { value: stored },
  });
  return NextResponse.json({ setting });
}
