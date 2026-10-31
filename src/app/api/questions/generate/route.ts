import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AI_NOT_CONFIGURED_MESSAGE, features } from "@/lib/config/features";
import { aiProvider, isContentLanguage, type GeneratedQuestion } from "@/lib/ai";
import { truncateForAI } from "@/lib/parsing/extractText";
import { isLevel } from "@/lib/levels";
import { requireAdmin, requireSuperadmin } from "@/lib/session";

// Генерирует банк вопросов. Три режима, от точного к общему:
// 1) topicId указан → вопросы генерируются по ВСЕМ правилам этой темы,
//    каждый вопрос сохраняется с полной трассировкой Question → Topic → Material
//    (раздел 21 запроса) — это основной путь после того, как материал прошёл
//    /api/materials/[id]/analyze.
// 2) ruleId указан → вопросы по одному конкретному правилу (более узкая генерация).
// 3) ни то ни другое → по всему тексту материала (обратная совместимость со
//    старыми материалами, для которых база знаний ещё не построена).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;

  if (!features.AI_CONFIGURED) return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  const body = await req.json();
  const { topicId, ruleId, level } = body;
  if (!isLevel(level)) {
    return NextResponse.json({ error: "Укажите уровень: BEGINNER, MIDDLE, PROFESSIONAL или EXAM" }, { status: 400 });
  }
  // Один запрос — до 10 вопросов, чтобы ответ ИИ не обрезался; больше браузер запрашивает порциями.
  // choiceCount / openCount — точно сколько с вариантами и сколько открытых (настройка «Материалы» → «Настройки создания»);
  // без них — count, а соотношение выбирает ИИ по уровню.
  const clamp = (v: unknown) => Math.min(Math.max(Math.round(Number(v)) || 0, 0), 10);
  const mix = body.choiceCount !== undefined || body.openCount !== undefined ? { choice: clamp(body.choiceCount), open: clamp(body.openCount) } : undefined;
  if (mix && (mix.choice + mix.open === 0 || mix.choice + mix.open > 10)) {
    return NextResponse.json({ error: "За один запрос — от 1 до 10 вопросов" }, { status: 400 });
  }
  const count = mix ? mix.choice + mix.open : Math.min(Math.max(Number(body.count) || 10, 1), 10);

  // Материал можно не передавать — он определяется по теме или правилу.
  const topic = topicId ? await db.topic.findUnique({ where: { id: topicId }, include: { rules: true } }) : null;
  const rule = ruleId ? await db.rule.findUnique({ where: { id: ruleId }, include: { topic: true } }) : null;
  if (topicId && !topic) return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });
  if (ruleId && !rule) return NextResponse.json({ error: "Правило не найдено" }, { status: 404 });

  const materialId: string | undefined = body.materialId ?? topic?.materialId ?? rule?.topic.materialId;
  const material = materialId ? await db.material.findUnique({ where: { id: materialId } }) : null;
  if (!material) {
    return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
  }
  if (!topic && !rule && !material.content) {
    return NextResponse.json(
      { error: "У материала нет извлечённого текста — загрузка не удалась или ссылка ещё не обработана" },
      { status: 422 }
    );
  }

  const language = isContentLanguage(body.language) ? body.language : "auto";
  let generated: GeneratedQuestion[];
  try {
    if (topic) {
      generated = await aiProvider.generateQuestionsForTopic(
        topic.name,
        topic.rules.map((r) => ({ type: r.type, text: r.text, sourceQuote: r.sourceQuote ?? undefined })),
        level,
        count,
        language,
        mix
      );
    } else if (rule) {
      generated = await aiProvider.generateQuestionsForTopic(
        rule.topic.name,
        [{ type: rule.type, text: rule.text, sourceQuote: rule.sourceQuote ?? undefined }],
        level,
        count,
        language,
        mix
      );
    } else {
      generated = await aiProvider.generateQuestions(truncateForAI(material.content!), level, count, undefined, language, mix);
    }
  } catch (e) {
    return NextResponse.json({ error: "ИИ не смог создать вопросы: " + String(e instanceof Error ? e.message : e) }, { status: 502 });
  }
  if (!generated.length) {
    // Пустой ответ бывает и по делу: в теме только правила для статей и постов, к ответам клиентам они не относятся.
    return NextResponse.json(
      { error: "ИИ не создал вопросов: в теме нет правил для ответов клиентам (например, только правила для статей) — или попробуйте ещё раз" },
      { status: 422 }
    );
  }

  const linkTopicId = topic?.id ?? rule?.topicId;
  const linkRuleId = rule?.id;

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
          modelAnswer: q.modelAnswer?.trim() || undefined,
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
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
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
