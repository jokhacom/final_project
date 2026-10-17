import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { levelReadiness } from "@/lib/readiness";
import { getQuestionCount, getTestMinutes } from "@/lib/testSettings";

// Какие уровни уже можно проходить (для карточек на странице выбора уровня).
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const [levels, minutes, count] = await Promise.all([levelReadiness(), getTestMinutes(), getQuestionCount()]);
  return NextResponse.json({ minutes, count, levels: levels.map((l) => ({ id: l.id, ready: l.ready, inTest: l.inTest })) });
}
