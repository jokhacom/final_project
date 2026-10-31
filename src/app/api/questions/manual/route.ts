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

// Начало дня по Ташкенту (UTC+5): "2026-10-27" → 2026-10-26T19:00Z. Неверная дата — null.
const dayStart = (day: string | null, plusDays = 0) => {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T00:00:00+05:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + plusDays);
  return d;
};

// Банк вопросов для админ-панели: фильтр по уровню и по дате создания (from/to — дни по Ташкенту, включительно).
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const level = req.nextUrl.searchParams.get("level");
  const archived = req.nextUrl.searchParams.get("archived") === "1";
  const from = dayStart(req.nextUrl.searchParams.get("from"));
  const toNext = dayStart(req.nextUrl.searchParams.get("to"), 1);
  const [questions, archivedCount] = await Promise.all([
    db.question.findMany({
      where: {
        ...(level ? { level: level as any } : {}),
        archivedAt: archived ? { not: null } : null,
        ...(from || toNext ? { createdAt: { ...(from ? { gte: from } : {}), ...(toNext ? { lt: toNext } : {}) } } : {}),
      },
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

// Удалить навсегда несколько вопросов: { ids: [...] } — только из архива; { ids, includeActive: true } — и те,
// что в тестах (кнопка «Удалить все показанные» с фильтром по дате). Вместе с ответами сотрудников на них.
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { ids, includeActive } = await req.json();
  if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ error: "Нужны ids" }, { status: 400 });
  const found = await db.question.findMany({
    where: { id: { in: ids.map(String) }, ...(includeActive === true ? {} : { archivedAt: { not: null } }) },
    select: { id: true },
  });
  const toDelete = found.map((q) => q.id);
  await db.$transaction([
    db.answer.deleteMany({ where: { questionId: { in: toDelete } } }),
    db.question.deleteMany({ where: { id: { in: toDelete } } }),
  ]);
  return NextResponse.json({ deleted: toDelete.length });
}
