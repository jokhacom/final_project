import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isTypingLanguage, TYPING_MODES } from "@/lib/typingWords";

const isMode = (n: number) => (TYPING_MODES as readonly number[]).includes(n);

// ?language=ru&seconds=30 — личный рекорд и топ-10 (лучший результат каждого сотрудника).
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const language = req.nextUrl.searchParams.get("language");
  const seconds = Number(req.nextUrl.searchParams.get("seconds"));
  if (!isTypingLanguage(language) || !isMode(seconds)) return NextResponse.json({ error: "Неверный режим" }, { status: 400 });

  const results = await db.typingResult.findMany({
    where: { language, seconds },
    orderBy: [{ wpm: "desc" }, { accuracy: "desc" }],
    include: { user: { select: { name: true } } },
    take: 500,
  });
  const best = new Map<string, (typeof results)[number]>();
  for (const r of results) if (!best.has(r.userId)) best.set(r.userId, r);
  const top = [...best.values()].slice(0, 10).map((r) => ({ name: r.user.name, wpm: r.wpm, accuracy: r.accuracy, me: r.userId === user.id }));
  const mine = best.get(user.id);
  return NextResponse.json({ top, personalBest: mine ? { wpm: mine.wpm, accuracy: mine.accuracy } : null });
}

// Сохранить результат.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const b = await req.json();
  const wpm = Math.round(Number(b.wpm));
  const rawWpm = Math.round(Number(b.rawWpm));
  const accuracy = Math.round(Number(b.accuracy));
  const seconds = Number(b.seconds);
  // Защита от явных опечаток и подделок: больше 300 слов в минуту люди не печатают.
  if (!isTypingLanguage(b.language) || !isMode(seconds) || !(wpm >= 0 && wpm <= 300) || !(rawWpm >= 0 && rawWpm <= 350) || !(accuracy >= 0 && accuracy <= 100)) {
    return NextResponse.json({ error: "Неверный результат" }, { status: 400 });
  }
  await db.typingResult.create({ data: { userId: user.id, language: b.language, seconds, wpm, rawWpm, accuracy } });
  return NextResponse.json({ ok: true });
}
