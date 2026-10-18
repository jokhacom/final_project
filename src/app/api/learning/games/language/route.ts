import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiProvider } from "@/lib/ai";
import { AI_NOT_CONFIGURED_MESSAGE, features } from "@/lib/config/features";
import { requireAdmin, requireSuperadmin } from "@/lib/session";
import { isGameLanguage, validateGameItem } from "@/lib/games";
import { LANGUAGE_BANK } from "@/lib/languageBank";

export const maxDuration = 60;

// «Грамотность»:
// { action: "starter", language } — добавить готовые вопросы (без дублей по тексту и вариантам);
// { action: "generate", language, count } — ИИ создаёт новые вопросы (только суперадмин).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, language } = body;
  if (!isGameLanguage(language)) return NextResponse.json({ error: "Выберите язык: русский или узбекский" }, { status: 400 });

  const admin = action === "generate" ? await requireSuperadmin() : await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const existing = await db.gameItem.findMany({ where: { kind: "LANGUAGE", language }, select: { prompt: true, options: true } });
  const key = (prompt: string, options: unknown) => `${prompt}|${JSON.stringify(options)}`;
  const seen = new Set(existing.map((e) => key(e.prompt, e.options)));

  let candidates: unknown[];
  if (action === "starter") {
    candidates = LANGUAGE_BANK[language].map((q) => ({ ...q, kind: "LANGUAGE", language, correctIndex: 0 }));
  } else if (action === "generate") {
    if (!features.AI_CONFIGURED) return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });
    const count = Math.min(Math.max(Math.round(Number(body.count) || 10), 1), 20);
    try {
      const generated = await aiProvider.generateLanguageItems(language, count, existing.map((e) => e.prompt + " " + JSON.stringify(e.options)).slice(0, 60));
      candidates = generated.map((g) => ({ ...g, kind: "LANGUAGE", language }));
    } catch (e) {
      return NextResponse.json({ error: "ИИ не смог создать вопросы: " + (e instanceof Error ? e.message : String(e)) }, { status: 502 });
    }
  } else {
    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  }

  const valid = candidates
    .map(validateGameItem)
    .flatMap((c) => ("data" in c ? [c.data] : []))
    .filter((d) => !seen.has(key(d.prompt, d.options)) && seen.add(key(d.prompt, d.options)));
  if (valid.length) await db.gameItem.createMany({ data: valid });
  return NextResponse.json({ created: valid.length });
}
