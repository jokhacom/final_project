import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  await db.replyDoc.deleteMany({ where: { id } });
  return NextResponse.json({ deleted: true });
}
