import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { CHUNK_BYTES, PRESENTATION_TYPES, extOf } from "@/lib/presentations";

export const maxDuration = 60;

// Собирает части файла, кладёт его в Vercel Blob и создаёт презентацию.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const body = await req.json();
  const uploadId = String(body.uploadId ?? "");
  const fileName = String(body.fileName ?? "").slice(0, 300);
  const size = Math.round(Number(body.size) || 0);
  const contentType = PRESENTATION_TYPES[extOf(fileName)];
  if (!contentType) return NextResponse.json({ error: "Нужен PDF или PowerPoint (.pptx, .ppt)" }, { status: 400 });

  const chunks = await db.uploadChunk.findMany({ where: { uploadId }, orderBy: { index: "asc" } });
  const expected = Math.ceil(size / CHUNK_BYTES);
  const data = Buffer.concat(chunks.map((c) => Buffer.from(c.data)));
  if (!size || chunks.length !== expected || chunks.some((c, i) => c.index !== i) || data.length !== size) {
    return NextResponse.json({ error: "Файл загрузился не полностью — попробуйте ещё раз" }, { status: 400 });
  }

  try {
    const stored = await put(`presentations/${Date.now()}.${extOf(fileName)}`, data, { access: "public", contentType, addRandomSuffix: true });
    const last = await db.presentation.aggregate({ _max: { order: true } });
    const item = await db.presentation.create({
      data: {
        order: (last._max.order ?? 0) + 1, // новая — в конец списка
        title: String(body.title || fileName.replace(/\.(pdf|pptx?)$/i, "")).trim().slice(0, 200),
        description: String(body.description || "").trim().slice(0, 1000) || null,
        fileName,
        url: stored.url,
        contentType,
        size,
      },
      select: { id: true, title: true },
    });
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: "Не удалось сохранить файл в хранилище: " + (e instanceof Error ? e.message : String(e)) }, { status: 502 });
  } finally {
    // Части больше не нужны; заодно убираем брошенные загрузки старше суток.
    await db.uploadChunk.deleteMany({ where: { OR: [{ uploadId }, { createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } }] } });
  }
}
