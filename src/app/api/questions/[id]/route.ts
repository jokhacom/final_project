import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AI_NOT_CONFIGURED_MESSAGE, features } from "@/lib/config/features";
import { aiProvider } from "@/lib/ai";
import { truncateForAI } from "@/lib/parsing/extractText";
import { requireAdmin } from "@/lib/session";
import { validateQuestion } from "@/lib/questions";

// Правка вопроса вручную (текст, варианты, правильный ответ, пояснение).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  const existing = await db.question.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Вопрос не найден" }, { status: 404 });

  const body = await req.json();

  // Архив: { archived: true } — убрать из тестов, { archived: false } — вернуть.
  if (typeof body.archived === "boolean") {
    const question = await db.question.update({ where: { id }, data: { archivedAt: body.archived ? new Date() : null } });
    return NextResponse.json({ question });
  }

  const merged = {
    type: body.type ?? existing.type,
    level: body.level ?? existing.level,
    text: body.text ?? existing.text,
    options: body.options ?? existing.options,
    correctIndex: body.correctIndex ?? existing.correctIndex,
    expectedKeywords: body.expectedKeywords ?? existing.expectedKeywords,
    explanation: body.explanation ?? existing.explanation,
    modelAnswer: body.modelAnswer ?? existing.modelAnswer,
    image: body.image ?? existing.image, // "" — убрать скриншот
  };
  const checked = validateQuestion(merged);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  const question = await db.question.update({ where: { id }, data: checked.data });
  return NextResponse.json({ question });
}

// Удалить ошибочно созданный вопрос.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  await db.answer.deleteMany({ where: { questionId: id } }); // сначала снять зависимые ответы
  await db.question.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}

// Перегенерировать задание, сохранив привязку к правилу/теме/документу.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  if (!features.AI_CONFIGURED) return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });

  const { id } = await params;
  const question = await db.question.findUnique({
    where: { id },
    include: { sourceMaterial: true, rule: true, topic: { include: { rules: true } } },
  });
  if (!question) return NextResponse.json({ error: "Вопрос не найден" }, { status: 404 });
  if (!question.topic && !question.sourceMaterial?.content) {
    return NextResponse.json({ error: "Нет текста материала для перегенерации" }, { status: 422 });
  }

  let generated;
  try {
    // По теме — из её правил (или одного правила, если вопрос к нему привязан); иначе — по тексту документа.
    const toRule = (r: { type: any; text: string; sourceQuote: string | null }) => ({ type: r.type, text: r.text, sourceQuote: r.sourceQuote ?? undefined });
    [generated] = question.topic
      ? await aiProvider.generateQuestionsForTopic(
          question.topic.name,
          (question.rule ? [question.rule] : question.topic.rules).map(toRule),
          question.level,
          1
        )
      : await aiProvider.generateQuestions(truncateForAI(question.sourceMaterial!.content!), question.level, 1, question.rule?.text);
  } catch (e) {
    return NextResponse.json({ error: "ИИ не смог создать вопрос: " + String(e instanceof Error ? e.message : e) }, { status: 502 });
  }
  if (!generated) return NextResponse.json({ error: "ИИ не вернул вопрос, попробуйте ещё раз" }, { status: 502 });

  const updated = await db.question.update({
    where: { id },
    data: {
      type: generated.type,
      text: generated.text,
      options: generated.options ?? undefined,
      correctIndex: generated.correctIndex ?? null,
      expectedKeywords: generated.expectedKeywords ?? undefined,
      explanation: generated.explanation ?? null,
    },
  });

  return NextResponse.json({ question: updated });
}
