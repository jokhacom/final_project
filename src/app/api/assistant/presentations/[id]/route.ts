import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { presentationTextSafe } from "@/lib/parsing/presentationText";
import { requireSuperadmin } from "@/lib/session";

export const maxDuration = 60;

// Прочитать текст презентации для «Помощника ответов». Нужно для презентаций, загруженных раньше:
// новые читаются сразу при загрузке. Файл — из базы (старые PDF) или из хранилища.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  const p = await db.presentation.findUnique({ where: { id }, select: { id: true, fileName: true, data: true, url: true } });
  if (!p) return NextResponse.json({ error: "Презентация не найдена" }, { status: 404 });

  let buffer: Buffer | null = p.data ? Buffer.from(p.data) : null;
  if (!buffer && p.url) {
    const res = await fetch(p.url).catch(() => null);
    if (!res?.ok) return NextResponse.json({ error: "Не удалось скачать файл из хранилища" }, { status: 502 });
    buffer = Buffer.from(await res.arrayBuffer());
  }
  const text = buffer ? await presentationTextSafe(buffer, p.fileName) : "";
  await db.presentation.update({ where: { id }, data: { text } });
  return NextResponse.json({ chars: text.length });
}
