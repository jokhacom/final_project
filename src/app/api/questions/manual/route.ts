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
  const questions = await db.question.findMany({
    where: level ? { level: level as any } : undefined,
    include: { sourceMaterial: { select: { title: true, version: true } }, topic: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ questions });
}
