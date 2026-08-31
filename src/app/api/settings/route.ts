import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Раздел 23: изменения дизайна/текстов/правил без кода.
// Примеры ключей: "daily_quiz_enabled", "theme_accent_color", "welcome_text".
export async function GET() {
  const settings = await db.setting.findMany();
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const { key, value } = await req.json();
  const setting = await db.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  return NextResponse.json({ setting });
}
