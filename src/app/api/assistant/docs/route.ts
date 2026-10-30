import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { db } from "@/lib/db";
import { extractText } from "@/lib/parsing/extractText";
import { activeMaterials, learningPresentations, MAX_KNOWLEDGE_CHARS, useMaterials, usePresentations } from "@/lib/assistant";
import { requireSuperadmin } from "@/lib/session";

// Файлы «Помощника ответов» (только суперадминистратор). Сам файл не храним — только текст.
export async function GET() {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;

  const docs = await db.replyDoc.findMany({ orderBy: { createdAt: "asc" } });
  const items = docs.map(({ content, ...d }) => ({ ...d, chars: content.length, preview: content.slice(0, 300) }));
  // Документы «Материалов», которые помощник тоже читает (если включено).
  const withMaterials = await useMaterials();
  const materials = (await activeMaterials()).map((m) => ({ id: m.id, title: m.title, chars: m.content?.length ?? 0 }));
  // Презентации «Обучения»: chars null — текст ещё не прочитан, 0 — текста нет (скан или старый .ppt).
  const withPresentations = await usePresentations();
  const presentations = (await learningPresentations()).map((p) => ({ id: p.id, title: p.title, fileName: p.fileName, chars: p.text === null ? null : p.text.length }));
  const sum = (list: { chars: number | null }[]) => list.reduce((n, x) => n + (x.chars ?? 0), 0);
  const totalChars =
    docs.reduce((n, d) => n + d.content.length, 0) + (withMaterials ? sum(materials) : 0) + (withPresentations ? sum(presentations) : 0);
  return NextResponse.json({
    items,
    materials,
    useMaterials: withMaterials,
    presentations,
    usePresentations: withPresentations,
    totalChars,
    maxChars: MAX_KNOWLEDGE_CHARS,
  });
}

// Добавить файл (PDF/DOCX/TXT) или вставленный текст: form-data с file или text, и title.
export async function POST(req: NextRequest) {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  let content = String(form.get("text") ?? "").trim();
  let fileName: string | null = null;

  if (file && file.size) {
    const ext = path.extname(file.name).toLowerCase().replace(".", "");
    if (!["pdf", "docx", "txt"].includes(ext)) return NextResponse.json({ error: "Поддерживаются только PDF, DOCX, TXT" }, { status: 400 });
    try {
      content = (await extractText(Buffer.from(await file.arrayBuffer()), ext as "pdf" | "docx" | "txt")).trim();
    } catch (e) {
      return NextResponse.json({ error: "Не удалось прочитать файл: " + String(e) }, { status: 422 });
    }
    if (!content) return NextResponse.json({ error: "В файле нет текста (возможно, это скан или картинки)" }, { status: 422 });
    fileName = file.name;
  }
  if (!content) return NextResponse.json({ error: "Выберите файл или вставьте текст" }, { status: 400 });

  const title = (String(form.get("title") ?? "").trim() || fileName?.replace(/\.(pdf|docx|txt)$/i, "") || content.slice(0, 60)).slice(0, 200);
  const item = await db.replyDoc.create({ data: { title, fileName, content }, select: { id: true, title: true } });
  return NextResponse.json({ item });
}
