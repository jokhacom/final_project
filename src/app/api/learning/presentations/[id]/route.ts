import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { del } from "@vercel/blob";
import { requireAdmin, requireUser } from "@/lib/session";
import { viewerUrl } from "@/lib/presentations";

// Сам файл: из базы (старые PDF) или переход к файлу в хранилище / просмотрщику PowerPoint.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const p = await db.presentation.findUnique({ where: { id } });
  if (!p) return NextResponse.json({ error: "Презентация не найдена" }, { status: 404 });
  if (p.url) return NextResponse.redirect(new URL(viewerUrl(p), _req.url));
  if (!p.data) return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  return new NextResponse(Buffer.from(p.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(p.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

// Переименовать / изменить описание / порядок.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  const body = await req.json();
  const data: { title?: string; description?: string | null; order?: number } = {};
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "Название не может быть пустым" }, { status: 400 });
    data.title = title.slice(0, 200);
  }
  if (body.description !== undefined) data.description = String(body.description).trim().slice(0, 1000) || null;
  if (body.order !== undefined) data.order = Math.round(Number(body.order) || 0);

  const item = await db.presentation.update({ where: { id }, data, select: { id: true } });
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  const p = await db.presentation.delete({ where: { id }, select: { url: true } });
  // Файл в хранилище; если не удалился за 10 секунд — запись всё равно убрана.
  if (p.url) await Promise.race([del(p.url), new Promise((r) => setTimeout(r, 10_000))]).catch(() => {});
  return NextResponse.json({ deleted: true });
}
