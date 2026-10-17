import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { validateGameItem } from "@/lib/games";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  const existing = await db.gameItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const body = await req.json();
  const checked = validateGameItem({ ...existing, ...body });
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const item = await db.gameItem.update({ where: { id }, data: checked.data });
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  await db.gameItem.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
