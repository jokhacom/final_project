import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { db } from "@/lib/db";
import { extractText } from "@/lib/parsing/extractText";
import { CHUNK_CHARS } from "@/lib/parsing/chunks";
import { requireAdmin, requireSuperadmin } from "@/lib/session";

// Принимает файл (PDF/DOCX/TXT), сразу извлекает текст и пишет запись Material
// со статусом PENDING. Сам файл не сохраняется: на Vercel диск только для чтения,
// а для базы знаний и проверки ответов нужен только извлечённый текст (content).
// Дальше — /api/materials/[id]/analyze (темы и правила) и /api/questions/generate.
export async function POST(req: NextRequest) {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const sourceUrl = (formData.get("sourceUrl") as string | null) || null;
  const title = (formData.get("title") as string) || file?.name || "Без названия";
  const replaceMaterialId = formData.get("replaceMaterialId") as string | null; // раздел 13: заменить документ новой версией

  if (!file && !sourceUrl) {
    return NextResponse.json({ error: "Нужен файл или ссылка" }, { status: 400 });
  }

  let type: string;
  let content: string | null = null;

  if (file) {
    const ext = path.extname(file.name).toLowerCase().replace(".", "");
    if (!["pdf", "docx", "txt"].includes(ext)) {
      return NextResponse.json({ error: "Поддерживаются только PDF, DOCX, TXT" }, { status: 400 });
    }
    type = ext;

    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      content = (await extractText(buffer, ext as "pdf" | "docx" | "txt")).trim() || null;
    } catch (e) {
      return NextResponse.json({ error: "Не удалось прочитать файл: " + String(e) }, { status: 422 });
    }
  } else {
    type = "link";
    // TODO продакшн: скачать и распарсить страницу по sourceUrl (например через fetch + readability)
  }

  let version = 1;
  if (replaceMaterialId) {
    const previous = await db.material.findUnique({ where: { id: replaceMaterialId } });
    if (previous) {
      version = previous.version + 1;
      // Старая версия деактивируется, но остаётся в базе — вопросы, созданные
      // по ней, сохраняют свой источник (раздел 14: старые задания связаны со старой версией).
      await db.material.update({ where: { id: previous.id }, data: { isActive: false } });
    }
  }

  const material = await db.material.create({
    data: {
      title,
      type,
      sourceUrl: sourceUrl ?? undefined,
      content,
      uploadedBy: admin.id,
      version,
      supersedesId: replaceMaterialId ?? undefined,
      status: content ? "PENDING" : "FAILED",
    },
  });

  return NextResponse.json({ material });
}

// Список материалов для админ-панели (карточки с кнопкой «Сгенерировать вопросы»).
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  // Текст документа (у книг — мегабайты) в список не отдаём, только его длину и число частей для ИИ.
  const [materials, lengths] = await Promise.all([
    db.material.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        version: true,
        isActive: true,
        createdAt: true,
        _count: { select: { questions: true, topics: true } },
      },
    }),
    db.$queryRaw<{ id: string; chars: number }[]>`SELECT id, COALESCE(length(content), 0)::int AS chars FROM "Material"`,
  ]);
  const charsById = new Map(lengths.map((l) => [l.id, Number(l.chars)]));
  return NextResponse.json({
    materials: materials.map((m) => {
      const chars = charsById.get(m.id) ?? 0;
      return { ...m, chars, chunks: Math.max(1, Math.ceil(chars / CHUNK_CHARS)) };
    }),
  });
}
