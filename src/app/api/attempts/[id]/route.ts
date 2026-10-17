import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/session";
import { buildResult } from "@/lib/attempts";

// Результат и разбор завершённой попытки (страница результата, повторное открытие из кабинета).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const attempt = await db.testAttempt.findUnique({ where: { id } });
  if (!attempt || (attempt.userId !== user.id && !isAdmin(user))) {
    return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
  }
  if (!attempt.finishedAt) {
    return NextResponse.json({ error: "Тест ещё не завершён" }, { status: 409 });
  }

  return NextResponse.json(await buildResult(id));
}
