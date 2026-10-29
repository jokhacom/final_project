import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";

// Управление сотрудниками — только суперадминистратор.
// Суперадминистратора и самого себя изменить или удалить нельзя.
async function loadTarget(id: string, selfId: string) {
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return { error: NextResponse.json({ error: "Пользователь не найден" }, { status: 404 }) };
  if (user.id === selfId || user.role === "SUPERADMIN") {
    return { error: NextResponse.json({ error: "Суперадминистратора изменить нельзя" }, { status: 403 }) };
  }
  return { user };
}

// Сменить роль (EMPLOYEE ↔ ADMIN), премиум-доступ или задать новый пароль.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  const target = await loadTarget(id, admin.id);
  if (target.error) return target.error;

  const body = await req.json();
  const data: { role?: "EMPLOYEE" | "ADMIN"; passwordHash?: string; attemptsResetAt?: Date; premium?: boolean; premiumFrom?: string | null; premiumUntil?: string | null } = {};
  if (typeof body.premium === "boolean") data.premium = body.premium; // доступ к «Помощнику ответов»
  // Срок премиума: "YYYY-MM-DD" или пусто — без ограничения.
  for (const key of ["premiumFrom", "premiumUntil"] as const) {
    if (body[key] === undefined) continue;
    const v = body[key] ? String(body[key]) : null;
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return NextResponse.json({ error: "Неверная дата" }, { status: 400 });
    data[key] = v;
  }
  if (data.premiumFrom && data.premiumUntil && data.premiumFrom > data.premiumUntil) {
    return NextResponse.json({ error: "Дата «с» позже даты «по»" }, { status: 400 });
  }
  if (body.resetAttempts === true) data.attemptsResetAt = new Date(); // история сохраняется, лимит считается заново
  if (body.role !== undefined) {
    if (body.role !== "EMPLOYEE" && body.role !== "ADMIN") {
      return NextResponse.json({ error: "Роль: сотрудник или администратор" }, { status: 400 });
    }
    data.role = body.role;
  }
  if (body.password !== undefined) {
    const password = String(body.password);
    if (password.length < 6) return NextResponse.json({ error: "Пароль должен быть не короче 6 символов" }, { status: 400 });
    data.passwordHash = await bcrypt.hash(password, 10);
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Нечего менять" }, { status: 400 });

  const user = await db.user.update({ where: { id }, data, select: { id: true, role: true } });
  return NextResponse.json({ user });
}

// Удалить сотрудника вместе с его попытками, ответами, рейтингом, достижениями и обращениями.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  const target = await loadTarget(id, admin.id);
  if (target.error) return target.error;

  await db.$transaction([
    db.answer.deleteMany({ where: { attempt: { userId: id } } }),
    db.testAttempt.deleteMany({ where: { userId: id } }),
    db.weakTopic.deleteMany({ where: { userId: id } }),
    db.userAchievement.deleteMany({ where: { userId: id } }),
    db.leaderboardEntry.deleteMany({ where: { userId: id } }),
    db.feedback.deleteMany({ where: { userId: id } }),
    db.user.delete({ where: { id } }),
  ]);
  return NextResponse.json({ deleted: true });
}
