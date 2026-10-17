import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// Раздел 20: "Что нового" — админ добавляет записи через эту же таблицу,
// сотрудники видят их на отдельной странице.
export async function GET() {
  const items = await db.changelog.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const data = await req.json();
  const title = String(data.title ?? "").trim();
  const body = String(data.body ?? "").trim();
  if (!title || !body) return NextResponse.json({ error: "Заполните заголовок и текст" }, { status: 400 });
  const item = await db.changelog.create({ data: { title, body } });
  return NextResponse.json({ item });
}
