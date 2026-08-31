import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiProvider } from "@/lib/ai";
import { truncateForAI } from "@/lib/parsing/extractText";

// Раздел 2, 13, 14 запроса: "Document uploaded → AI reading → AI analyzing →
// Training generated → Ready". Этот эндпоинт — шаги "AI reading/analyzing":
// ИИ читает материал целиком и строит структурированную базу знаний
// (Topic + Rule), НЕ создавая пока вопросы — это отдельный шаг
// (POST /api/questions/generate с topicId), чтобы Super Admin мог сначала
// проверить/поправить извлечённые темы и правила перед генерацией заданий.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const material = await db.material.findUnique({ where: { id: params.id } });
  if (!material) {
    return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
  }
  if (!material.content) {
    return NextResponse.json({ error: "У материала нет извлечённого текста" }, { status: 422 });
  }

  await db.material.update({ where: { id: material.id }, data: { status: "ANALYZING" } });

  try {
    const extracted = await aiProvider.extractKnowledge(truncateForAI(material.content, 14000));

    // Пересоздаём базу знаний для этого материала (на случай повторного анализа).
    await db.topic.deleteMany({ where: { materialId: material.id } });

    const createdTopics = [];
    for (const t of extracted) {
      const topic = await db.topic.create({
        data: {
          materialId: material.id,
          name: t.name,
          description: t.description ?? null,
        },
      });
      if (t.rules?.length) {
        await db.rule.createMany({
          data: t.rules.map((r) => ({
            topicId: topic.id,
            type: r.type,
            text: r.text,
            sourceQuote: r.sourceQuote ?? null,
          })),
        });
      }
      createdTopics.push(topic);
    }

    await db.material.update({ where: { id: material.id }, data: { status: "PROCESSED" } });

    const topicsWithRules = await db.topic.findMany({
      where: { materialId: material.id },
      include: { rules: true },
    });

    return NextResponse.json({ topics: topicsWithRules });
  } catch (e) {
    await db.material.update({ where: { id: material.id }, data: { status: "FAILED" } });
    return NextResponse.json({ error: "Не удалось построить базу знаний: " + String(e) }, { status: 500 });
  }
}
