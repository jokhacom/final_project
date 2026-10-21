import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { validateQuestion } from "@/lib/questions";

// Ручное создание вопроса без ИИ. Пишет в ту же таблицу Question, что и
// ИИ-генерация, — оба способа совместимы и работают параллельно.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const checked = validateQuestion(await req.json());
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  const question = await db.question.create({ data: checked.data });
  return NextResponse.json({ question });
}

// Банк вопросов для админ-панели (фильтр по уровню).
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const level = req.nextUrl.searchParams.get("level");
  const archived = req.nextUrl.searchParams.get("archived") === "1";
  const [questions, archivedCount] = await Promise.all([
    db.question.findMany({
      where: { ...(level ? { level: level as any } : {}), archivedAt: archived ? { not: null } : null },
      include: { sourceMaterial: { select: { title: true, version: true } }, topic: { select: { name: true } } },
      orderBy: archived ? { archivedAt: "desc" } : { createdAt: "desc" },
    }),
    db.question.count({ where: { archivedAt: { not: null } } }),
  ]);
  return NextResponse.json({ questions, archivedCount });
}

// Убрать в архив или вернуть сразу несколько вопросов: { ids: [...], archived: true | false }.
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { ids, archived } = await req.json();
  if (!Array.isArray(ids) || !ids.length || typeof archived !== "boolean") {
    return NextResponse.json({ error: "Нужны ids и archived" }, { status: 400 });
  }
  const r = await db.question.updateMany({
    where: { id: { in: ids.map(String) } },
    data: { archivedAt: archived ? new Date() : null },
  });
  return NextResponse.json({ updated: r.count });
}
