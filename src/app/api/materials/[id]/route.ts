import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";

// Удалить документ вместе со всем, что по нему создано: темы, правила, вопросы (и ответы
// сотрудников на них — как при удалении одного вопроса), элементы игр по его темам.
// Результаты (конфеты) прошлых попыток сохраняются.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  const material = await db.material.findUnique({ where: { id }, select: { id: true } });
  if (!material) return NextResponse.json({ error: "Документ не найден" }, { status: 404 });

  const topicIds = (await db.topic.findMany({ where: { materialId: id }, select: { id: true } })).map((t) => t.id);
  const questionWhere = { OR: [{ sourceMaterialId: id }, { topicId: { in: topicIds } }] };
  const questionIds = (await db.question.findMany({ where: questionWhere, select: { id: true } })).map((q) => q.id);

  const [, , , games] = await db.$transaction([
    db.answer.deleteMany({ where: { questionId: { in: questionIds } } }),
    db.question.deleteMany({ where: { id: { in: questionIds } } }),
    db.rule.deleteMany({ where: { topicId: { in: topicIds } } }),
    db.gameItem.deleteMany({ where: { topicId: { in: topicIds } } }),
    db.topic.deleteMany({ where: { id: { in: topicIds } } }),
    db.material.updateMany({ where: { supersedesId: id }, data: { supersedesId: null } }), // новая версия остаётся
    db.material.delete({ where: { id } }),
  ]);
  return NextResponse.json({ deleted: true, questions: questionIds.length, games: games.count });
}
