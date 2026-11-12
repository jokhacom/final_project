import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { usageLimit } from "@/lib/assistant";
import { requireAdmin, requireSuperadmin } from "@/lib/session";
import { validateNewUser } from "@/lib/users";
import { getUserLimit } from "@/lib/testSettings";

// Список сотрудников для админ-панели (выгрузка по одному сотруднику, просмотр кабинета).
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const rows = await db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, username: true, role: true, createdAt: true, leaderboard: true,
      premium: true, premiumFrom: true, premiumUntil: true, premiumLimit: true, premiumLimitPeriod: true,
    },
  });
  // premiumUsed — сколько ответов помощника уже получено в текущем периоде лимита.
  const users = await Promise.all(
    rows.map(async (u) => ({ ...u, premiumUsed: u.premium && u.premiumLimit !== null ? (await usageLimit(u))?.used ?? 0 : null }))
  );
  // limit — максимум пользователей (0 — без ограничений); считаются все, кроме суперадминистратора.
  return NextResponse.json({ users, limit: await getUserLimit(), counted: users.filter((u) => u.role !== "SUPERADMIN").length });
}

// Суперадминистратор сам создаёт пользователя: придумывает логин и пароль и передаёт их сотруднику.
// Лимит пользователей действует и здесь — его можно увеличить на «Обзоре».
export async function POST(req: NextRequest) {
  const admin = await requireSuperadmin();
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  const invalid = validateNewUser(body.name, body.username, body.password);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  const role = body.role === "ADMIN" ? "ADMIN" : "EMPLOYEE";
  const username = String(body.username).trim();

  const limit = await getUserLimit();
  if (limit && (await db.user.count({ where: { role: { not: "SUPERADMIN" } } })) >= limit) {
    return NextResponse.json({ error: `Достигнут лимит пользователей (${limit}). Увеличьте его в «Настройках» ниже или удалите лишних.` }, { status: 403 });
  }
  // Логины сравниваем без учёта регистра, чтобы не было «Nigora» и «nigora» одновременно.
  if (await db.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } })) {
    return NextResponse.json({ error: "Такой логин уже занят" }, { status: 409 });
  }

  const user = await db.user.create({
    data: { name: String(body.name).trim(), username, passwordHash: await bcrypt.hash(String(body.password), 10), role },
    select: { id: true, name: true, username: true, role: true },
  });
  return NextResponse.json({ user });
}
