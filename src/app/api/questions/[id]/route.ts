import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiProvider } from "@/lib/ai";
import { truncateForAI } from "@/lib/parsing/extractText";

// Раздел 21 запроса: позволить Super Admin удалить ошибочно созданный вопрос.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await db.answer.deleteMany({ where: { questionId: params.id } }); // сначала снять зависимые ответы
  await db.question.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}

// Раздел 21 запроса: перегенерировать конкретное задание, сохранив ту же
// привязку к правилу/теме/документу — чтобы не терять цепочку источника.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const question = await db.question.findUnique({
    where: { id: params.id },
    include: { sourceMaterial: true, rule: true },
  });
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });
  if (!question.sourceMaterial?.content) {
    return NextResponse.json({ error: "Нет текста материала для перегенерации" }, { status: 422 });
  }

  const [generated] = await aiProvider.generateQuestions(
    truncateForAI(question.sourceMaterial.content),
    question.level,
    1,
    question.rule?.text
  );

  const updated = await db.question.update({
    where: { id: params.id },
    data: {
      text: generated.text,
      options: generated.options ?? undefined,
      correctIndex: generated.correctIndex ?? undefined,
      expectedKeywords: generated.expectedKeywords ?? undefined,
      explanation: generated.explanation ?? undefined,
    },
  });

  return NextResponse.json({ question: updated });
}
