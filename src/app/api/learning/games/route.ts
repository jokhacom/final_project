import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin, requireAdmin, requireUser } from "@/lib/session";
import { isGameKind, validateGameItem } from "@/lib/games";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ?kind=TRUE_FALSE|FLASHCARD|FIX_ERROR — раунд игры (до 12 случайных элементов).
// ?all=1 — полный список для админ-панели.
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const kind = req.nextUrl.searchParams.get("kind");
  const all = req.nextUrl.searchParams.get("all") === "1" && isAdmin(user);
  const where = isGameKind(kind) ? { kind } : {};

  const items = await db.gameItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { topic: { select: { name: true } } },
  });
  const counts = await db.gameItem.groupBy({ by: ["kind"], _count: { _all: true } });

  return NextResponse.json({
    items: all ? items : shuffle(items).slice(0, 12),
    counts: Object.fromEntries(counts.map((c) => [c.kind, c._count._all])),
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
