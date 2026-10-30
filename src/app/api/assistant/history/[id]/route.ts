import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { awardAchievement } from "@/lib/assistant";
import { requireUser } from "@/lib/session";

// Своя запись истории: ⭐ избранное или «упражнения тренера решены» (coachDone — достижение «🎯 С тренером»).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const item = await db.assistantReply.findFirst({ where: { id, userId: user.id }, select: { id: true, mode: true } });
  if (!item) return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.favorite === "boolean") await db.assistantReply.update({ where: { id }, data: { favorite: body.favorite } });
  const achievement = body.coachDone === true && item.mode === "coach" ? await awardAchievement(user.id, "coach") : null;
  return NextResponse.json({ ok: true, achievements: achievement ? [achievement] : [] });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  await db.assistantReply.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ deleted: true });
}
