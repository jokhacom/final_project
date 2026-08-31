import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { extractText } from "@/lib/parsing/extractText";

// Принимает настоящий файл (PDF/DOCX/TXT) или ссылку, сохраняет на диск,
// сразу извлекает текст и пишет запись Material со статусом PENDING.
// После этого админ (или автоматически) вызывает /api/questions/generate,
// который читает material.content и создаёт вопросы через aiProvider.
//
// TODO продакшн: вместо локальной файловой системы — загрузка в S3/облачное
// хранилище (Vercel не хранит файлы между деплоями на диске).
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const sourceUrl = formData.get("sourceUrl") as string | null;
  const uploadedBy = formData.get("uploadedBy") as string;
  const title = (formData.get("title") as string) || file?.name || "Без названия";
  const replaceMaterialId = formData.get("replaceMaterialId") as string | null; // раздел 13: заменить документ новой версией

  if (!file && !sourceUrl) {
    return NextResponse.json({ error: "Нужен файл или ссылка" }, { status: 400 });
  }

  let type: string;
  let filePath: string | null = null;
  let content: string | null = null;

  if (file) {
    const ext = path.extname(file.name).toLowerCase().replace(".", "");
    if (!["pdf", "docx", "txt"].includes(ext)) {
      return NextResponse.json({ error: "Поддерживаются только PDF, DOCX, TXT" }, { status: 400 });
    }
    type = ext;

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadsDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });
    filePath = path.join(uploadsDir, `${Date.now()}-${file.name}`);
    await writeFile(filePath, buffer);

    try {
      content = await extractText(buffer, ext as "pdf" | "docx" | "txt");
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
      filePath,
      sourceUrl: sourceUrl ?? undefined,
      content,
      uploadedBy,
      version,
      supersedesId: replaceMaterialId ?? undefined,
      status: content ? "PENDING" : "FAILED",
    },
  });

  return NextResponse.json({ material });
}

// Список материалов для админ-панели (карточки с кнопкой «Сгенерировать вопросы»).
export async function GET() {
  const materials = await db.material.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true } } },
  });
  return NextResponse.json({ materials });
}
