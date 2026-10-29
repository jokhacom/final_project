import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { PRESENTATION_TYPES } from "@/lib/presentations";

const MAX_SIZE = 4 * 1024 * 1024; // без Blob файл идёт через функцию — лимит тела запроса Vercel около 4,5 МБ

// Список презентаций для раздела «Обучение» (без самих файлов).
// blob — подключено ли хранилище Vercel Blob (тогда можно PowerPoint и большие файлы):
// новое подключение даёт BLOB_STORE_ID (вход без ключа), старое — BLOB_READ_WRITE_TOKEN.
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const items = await db.presentation.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, description: true, fileName: true, url: true, size: true, order: true, createdAt: true },
  });
  return NextResponse.json({ items, blob: !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) });
}

// Добавить презентацию старым способом: form-data с PDF до 4 МБ, хранится в базе.
// С хранилищем файлов загрузка идёт через /chunk и /finish.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

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
  const last = await db.presentation.aggregate({ _max: { order: true } });
  const item = await db.presentation.create({
    data: { title, description, fileName: file.name, data, size: data.length, contentType: PRESENTATION_TYPES.pdf, order: (last._max.order ?? 0) + 1 },
    select: { id: true, title: true },
  });
  return NextResponse.json({ item });
}

// Изменить порядок: { ids: [...] } — презентации в нужном порядке, order = позиция в списке.
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown): id is string => typeof id === "string") : [];
  if (!ids.length) return NextResponse.json({ error: "Пустой список" }, { status: 400 });
  await db.$transaction(ids.map((id: string, i: number) => db.presentation.updateMany({ where: { id }, data: { order: i } })));
  return NextResponse.json({ ok: true });
}
