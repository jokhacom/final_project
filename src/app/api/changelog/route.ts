import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Раздел 20: "Что нового" — админ добавляет записи через эту же таблицу,
// сотрудники видят их на отдельной странице.
export async function GET() {
  const items = await db.changelog.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const { title, body } = await req.json();
  const item = await db.changelog.create({ data: { title, body } });
  return NextResponse.json({ item });
}
