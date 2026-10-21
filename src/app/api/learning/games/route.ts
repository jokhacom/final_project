import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin, requireAdmin, requireUser } from "@/lib/session";
import { getGameTimers } from "@/lib/testSettings";
import { GAME_KINDS, LANGUAGE_ROUND, isGameKind, isGameLanguage, validateGameItem } from "@/lib/games";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ?kind=TRUE_FALSE|FIX_ERROR — раунд игры (до 12 случайных элементов);
// ?kind=LANGUAGE&language=ru|uz — раунд «Грамотности» (10 вопросов одного языка).
// ?all=1 — полный список для админ-панели.
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const kind = req.nextUrl.searchParams.get("kind");
  const all = req.nextUrl.searchParams.get("all") === "1" && isAdmin(user);
  const language = req.nextUrl.searchParams.get("language");
  const visible = { kind: { in: [...GAME_KINDS] } };
  const where = isGameKind(kind) ? { kind, ...(kind === "LANGUAGE" && isGameLanguage(language) ? { language } : {}) } : visible;

  const items = await db.gameItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { topic: { select: { name: true } } },
  });
  const [counts, langCounts] = await Promise.all([
    db.gameItem.groupBy({ by: ["kind"], where: visible, _count: { _all: true } }),
    db.gameItem.groupBy({ by: ["language"], where: { kind: "LANGUAGE" }, _count: { _all: true } }),
  ]);

  return NextResponse.json({
    items: all ? items : shuffle(items).slice(0, kind === "LANGUAGE" ? LANGUAGE_ROUND : 12),
    counts: Object.fromEntries(counts.map((c) => [c.kind, c._count._all])),
    languages: Object.fromEntries(langCounts.map((c) => [c.language, c._count._all])),
    timers: await getGameTimers(), // секунд на один ответ в каждой игре
  });
}

// Добавить элемент игры вручную.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const checked = validateGameItem(await req.json());
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const item = await db.gameItem.create({ data: checked.data });
  return NextResponse.json({ item });
}
