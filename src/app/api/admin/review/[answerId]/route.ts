import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { reviewAnswer } from "@/lib/attempts";

// Сохранить ручную оценку ответа: верно/неверно, ошибки, комментарий для сотрудника.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ answerId: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { answerId } = await params;
  const existing = await db.answer.findUnique({ where: { id: answerId } });
  if (!existing) return NextResponse.json({ error: "Ответ не найден" }, { status: 404 });

  const body = await req.json();
  const count = (v: unknown) => Math.min(Math.max(Math.round(Number(v) || 0), 0), 20);
  const result = await reviewAnswer(answerId, admin.id, {
    isCorrect: !!body.isCorrect,
    spellingErrors: count(body.spellingErrors),
    grammarErrors: count(body.grammarErrors),
    comment: body.comment ? String(body.comment).trim().slice(0, 2000) || null : null,
  });
  return NextResponse.json(result);
}
