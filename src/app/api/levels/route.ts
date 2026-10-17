import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { levelReadiness } from "@/lib/readiness";

// Какие уровни уже можно проходить (для карточек на странице выбора уровня).
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const levels = await levelReadiness();
  return NextResponse.json({ levels: levels.map((l) => ({ id: l.id, ready: l.ready })) });
}
