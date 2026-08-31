import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Раздел 6-7 ТЗ можно выполнить и вручную, без ИИ: Суперадминистратор
// сам создает вопросы через эту форму. Когда позже подключим ИИ-генерацию
// из документов (/api/questions/generate), она будет писать в ту же таблицу
// Question — обе формы создания вопросов совместимы и работают параллельно.
export async function POST(req: NextRequest) {
  const { type, level, text, options, correctIndex, expectedKeywords } = await req.json();

  if (!type || !level || !text) {
    return NextResponse.json({ error: "Не заполнены обязательные поля" }, { status: 400 });
  }
  if (type === "MULTIPLE_CHOICE" && (!options || options.length < 2 || correctIndex === undefined)) {
    return NextResponse.json({ error: "Для вопроса с вариантами нужны options и correctIndex" }, { status: 400 });
  }
  if (type === "OPEN" && (!expectedKeywords || expectedKeywords.length === 0)) {
    return NextResponse.json({ error: "Для открытого вопроса нужны ключевые слова ожидаемого ответа" }, { status: 400 });
  }

  const question = await db.question.create({
    data: {
      type,
      level,
      text,
      options: type === "MULTIPLE_CHOICE" ? options : undefined,
      correctIndex: type === "MULTIPLE_CHOICE" ? correctIndex : undefined,
      expectedKeywords: type === "OPEN" ? expectedKeywords : undefined,
    },
  });

  return NextResponse.json({ question });
}

export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get("level");
  const questions = await db.question.findMany({
    where: level ? { level: level as any } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ questions });
}
