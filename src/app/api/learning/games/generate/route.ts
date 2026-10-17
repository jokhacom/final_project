import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiProvider } from "@/lib/ai";
import { AI_NOT_CONFIGURED_MESSAGE, features } from "@/lib/config/features";
import { requireSuperadmin } from "@/lib/session";
import { validateGameItem } from "@/lib/games";

export const maxDuration = 60;

// ИИ создаёт элементы обеих игр по правилам одной темы.
export async function POST(req: NextRequest) {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;
  if (!features.AI_CONFIGURED) return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });

  const { topicId, count } = await req.json();
  const topic = await db.topic.findUnique({ where: { id: topicId }, include: { rules: true } });
  if (!topic) return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });
  const n = Math.min(Math.max(Math.round(Number(count) || 3), 1), 10);

  let generated;
  try {
    generated = await aiProvider.generateGameItems(
      topic.name,
      topic.rules.map((r) => ({ type: r.type, text: r.text, sourceQuote: r.sourceQuote ?? undefined })),
      n
    );
  } catch (e) {
    return NextResponse.json({ error: "ИИ не смог создать игры: " + (e instanceof Error ? e.message : String(e)) }, { status: 502 });
  }

  const valid = generated.map(validateGameItem).flatMap((c) => ("data" in c ? [{ ...c.data, topicId: topic.id }] : []));
  if (!valid.length) return NextResponse.json({ error: "ИИ не вернул ни одного корректного элемента" }, { status: 502 });
  await db.gameItem.createMany({ data: valid });
  return NextResponse.json({ created: valid.length });
}
