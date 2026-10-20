import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { CHUNK_BYTES, MAX_PRESENTATION_MB } from "@/lib/presentations";

// Одна часть загружаемой презентации: ?uploadId=...&index=0, тело — байты файла.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const uploadId = req.nextUrl.searchParams.get("uploadId") ?? "";
  const index = Number(req.nextUrl.searchParams.get("index"));
  if (!/^[a-z0-9-]{8,64}$/i.test(uploadId) || !Number.isInteger(index) || index < 0 || index * CHUNK_BYTES >= MAX_PRESENTATION_MB * 1024 * 1024) {
    return NextResponse.json({ error: "Неверная часть файла" }, { status: 400 });
  }
  const data = Buffer.from(await req.arrayBuffer());
  if (!data.length || data.length > CHUNK_BYTES) return NextResponse.json({ error: "Неверный размер части" }, { status: 400 });

  // Повтор той же части (после обрыва связи) просто перезаписывает её.
  await db.uploadChunk.upsert({
    where: { uploadId_index: { uploadId, index } },
    create: { uploadId, index, data },
    update: { data },
  });
  return NextResponse.json({ ok: true });
}
