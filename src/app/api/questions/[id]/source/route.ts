import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Раздел 21 запроса: у каждого вопроса должна быть прослеживаемая цепочка
// Question → Topic → Rule → Source Document, чтобы Super Admin мог понять,
// откуда ИИ взял этот вопрос, и при необходимости удалить/перегенерировать его.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const question = await db.question.findUnique({
    where: { id: params.id },
    include: {
      sourceMaterial: true,
      topic: true,
      rule: { include: { topic: { include: { material: true } } } },
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  return NextResponse.json({
    question: { id: question.id, text: question.text, type: question.type, level: question.level },
    rule: question.rule ? { id: question.rule.id, type: question.rule.type, text: question.rule.text, sourceQuote: question.rule.sourceQuote } : null,
    topic: question.topic ?? question.rule?.topic ?? null,
    material: question.sourceMaterial ?? question.rule?.topic.material ?? null,
    traceable: !!(question.ruleId || question.topicId || question.sourceMaterialId),
  });
}
