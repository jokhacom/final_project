import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AI_NOT_CONFIGURED_MESSAGE, features } from "@/lib/config/features";
import { requireSuperadmin } from "@/lib/session";
import { aiProvider } from "@/lib/ai";
import { splitIntoChunks } from "@/lib/parsing/chunks";

// Каждый вызов — один запрос к ИИ, чтобы уложиться в лимит времени функции Vercel.
export const maxDuration = 60;

// ИИ читает документ ПО ЧАСТЯМ и строит базу знаний (Topic + Rule).
// Браузер вызывает этот эндпоинт по очереди для каждой части:
//   { chunk: 0 }       — начать заново (старая база знаний документа очищается),
//   { chunk: N }       — разобрать часть N и добавить темы/правила,
//   { finalize: true } — отметить документ как готовый.
// Темы с одинаковым названием из разных частей объединяются.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;
  if (!features.AI_CONFIGURED) return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });

  const { id } = await params;
  const material = await db.material.findUnique({ where: { id } });
  if (!material) return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
  if (!material.content) return NextResponse.json({ error: "У материала нет извлечённого текста" }, { status: 422 });

  const body = await req.json().catch(() => ({}));
  const chunks = splitIntoChunks(material.content);

  if (body.finalize) {
    const topics = await db.topic.count({ where: { materialId: id } });
    await db.material.update({ where: { id }, data: { status: topics ? "PROCESSED" : "FAILED" } });
    return NextResponse.json({ done: true, topics, chunkCount: chunks.length });
  }

  const index = Math.max(0, Math.floor(Number(body.chunk) || 0));
  if (index >= chunks.length) return NextResponse.json({ error: "Нет такой части документа" }, { status: 400 });

  if (index === 0) {
    // Повторный анализ: прежние темы и правила удаляем, а уже созданные вопросы
    // сохраняем — просто отвязываем их от удаляемых тем.
    await db.$transaction([
      db.question.updateMany({ where: { topic: { materialId: id } }, data: { topicId: null, ruleId: null } }),
      db.rule.deleteMany({ where: { topic: { materialId: id } } }),
      db.topic.deleteMany({ where: { materialId: id } }),
      db.material.update({ where: { id }, data: { status: "ANALYZING" } }),
    ]);
  }

  let extracted;
  try {
    extracted = await aiProvider.extractKnowledge(chunks[index]);
  } catch (e) {
    return NextResponse.json(
      { error: `Не удалось разобрать часть ${index + 1}: ${e instanceof Error ? e.message : String(e)}`, chunkCount: chunks.length },
      { status: 502 }
    );
  }

  let topicsAdded = 0;
  let rulesAdded = 0;
  for (const t of Array.isArray(extracted) ? extracted : []) {
    const name = String(t?.name ?? "").trim();
    const rules = (Array.isArray(t?.rules) ? t.rules : []).filter((r: any) => r?.text && r?.type);
    if (!name || !rules.length) continue;

    const existing = await db.topic.findFirst({ where: { materialId: id, name: { equals: name, mode: "insensitive" } } });
    const topic =
      existing ?? (await db.topic.create({ data: { materialId: id, name, description: t.description ?? null } }));
    if (!existing) topicsAdded++;

    await db.rule.createMany({
      data: rules.map((r: any) => ({ topicId: topic.id, type: r.type, text: String(r.text), sourceQuote: r.sourceQuote ?? null })),
    });
    rulesAdded += rules.length;
  }

  return NextResponse.json({ chunk: index, chunkCount: chunks.length, topicsAdded, rulesAdded });
}
