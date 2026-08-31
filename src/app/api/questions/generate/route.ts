import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiProvider } from "@/lib/ai";
import { truncateForAI } from "@/lib/parsing/extractText";

// Генерирует банк вопросов. Три режима, от точного к общему:
// 1) topicId указан → вопросы генерируются по ВСЕМ правилам этой темы,
//    каждый вопрос сохраняется с полной трассировкой Question → Topic → Material
//    (раздел 21 запроса) — это основной путь после того, как материал прошёл
//    /api/materials/[id]/analyze.
// 2) ruleId указан → вопросы по одному конкретному правилу (более узкая генерация).
// 3) ни то ни другое → по всему тексту материала (обратная совместимость со
//    старыми материалами, для которых база знаний ещё не построена).
export async function POST(req: NextRequest) {
  const { materialId, topicId, ruleId, level, count } = await req.json();

  const material = await db.material.findUnique({ where: { id: materialId } });
  if (!material) {
    return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
  }

  let generated;
  let linkTopicId: string | undefined;
  let linkRuleId: string | undefined;

  if (topicId) {
    const topic = await db.topic.findUnique({ where: { id: topicId }, include: { rules: true } });
    if (!topic) return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });

    generated = await aiProvider.generateQuestionsForTopic(
      topic.name,
      topic.rules.map((r) => ({ type: r.type as any, text: r.text, sourceQuote: r.sourceQuote ?? undefined })),
      level,
      count ?? 10
    );
    linkTopicId = topic.id;
  } else if (ruleId) {
    const rule = await db.rule.findUnique({ where: { id: ruleId }, include: { topic: true } });
    if (!rule) return NextResponse.json({ error: "Правило не найдено" }, { status: 404 });

    generated = await aiProvider.generateQuestionsForTopic(rule.topic.name, [{ type: rule.type as any, text: rule.text, sourceQuote: rule.sourceQuote ?? undefined }], level, count ?? 10);
    linkTopicId = rule.topicId;
    linkRuleId = rule.id;
  } else {
    if (!material.content) {
      return NextResponse.json(
        { error: "У материала нет извлечённого текста — загрузка не удалась или ссылка ещё не обработана" },
        { status: 422 }
      );
    }
    generated = await aiProvider.generateQuestions(truncateForAI(material.content), level, count ?? 10);
  }

  const created = await db.$transaction(
    generated.map((q) =>
      db.question.create({
        data: {
          type: q.type,
          level,
          text: q.text,
          options: q.options ?? undefined,
          correctIndex: q.correctIndex ?? undefined,
          expectedKeywords: q.expectedKeywords ?? undefined,
          explanation: q.explanation ?? undefined,
          sourceMaterialId: material.id,
          topicId: linkTopicId,
          ruleId: linkRuleId,
        },
      })
    )
  );

  return NextResponse.json({ questions: created });
}

// Список сгенерированных вопросов по материалу — чтобы админ мог проверить их перед публикацией.
export async function GET(req: NextRequest) {
  const materialId = req.nextUrl.searchParams.get("materialId");
  const topicId = req.nextUrl.searchParams.get("topicId");
  const questions = await db.question.findMany({
    where: {
      ...(materialId ? { sourceMaterialId: materialId } : {}),
      ...(topicId ? { topicId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ questions });
}
