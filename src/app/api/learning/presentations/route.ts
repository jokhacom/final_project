import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { PRESENTATION_TYPES, extOf } from "@/lib/presentations";

const MAX_SIZE = 4 * 1024 * 1024; // без Blob файл идёт через функцию — лимит тела запроса Vercel около 4,5 МБ

// Список презентаций для раздела «Обучение» (без самих файлов).
// blob — подключено ли хранилище Vercel Blob (тогда можно PowerPoint и большие файлы).
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const items = await db.presentation.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, description: true, fileName: true, url: true, size: true, order: true, createdAt: true },
  });
  return NextResponse.json({ items, blob: !!process.env.BLOB_READ_WRITE_TOKEN });
}

// Добавить презентацию:
// JSON { url, fileName, size, title, description } — файл уже загружен в Vercel Blob;
// form-data с файлом — старый способ, только PDF до 4 МБ, хранится в базе.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  if (req.headers.get("content-type")?.includes("application/json")) {
    const body = await req.json();
    const url = String(body.url ?? "");
    const fileName = String(body.fileName ?? "").slice(0, 300);
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {}
    if (!host.endsWith(".blob.vercel-storage.com")) return NextResponse.json({ error: "Файл не загружен в хранилище" }, { status: 400 });
    const contentType = PRESENTATION_TYPES[extOf(fileName)];
    if (!contentType) return NextResponse.json({ error: "Нужен PDF или PowerPoint (.pptx, .ppt)" }, { status: 400 });
    const item = await db.presentation.create({
      data: {
        title: String(body.title || fileName.replace(/\.(pdf|pptx?)$/i, "")).trim().slice(0, 200),
        description: String(body.description || "").trim().slice(0, 1000) || null,
        fileName,
        url,
        contentType,
        size: Math.max(0, Math.round(Number(body.size) || 0)),
      },
      select: { id: true, title: true },
    });
    return NextResponse.json({ item });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Без хранилища файлов можно только PDF. В PowerPoint: Файл → Сохранить как → PDF" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Файл больше 4 МБ — подключите хранилище файлов (см. README) или сожмите PDF" }, { status: 400 });

  const data = Buffer.from(await file.arrayBuffer());
  if (data.subarray(0, 5).toString() !== "%PDF-") return NextResponse.json({ error: "Файл не похож на PDF" }, { status: 400 });

  const title = String(form.get("title") || file.name.replace(/\.pdf$/i, "")).trim().slice(0, 200);
  const description = String(form.get("description") || "").trim().slice(0, 1000) || null;
  const item = await db.presentation.create({
    data: { title, description, fileName: file.name, data, size: data.length, contentType: PRESENTATION_TYPES.pdf },
    select: { id: true, title: true },
  });
  return NextResponse.json({ item });
}
