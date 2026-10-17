import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { db } from "./db";

export type Role = "EMPLOYEE" | "ADMIN" | "SUPERADMIN";
export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

// Кто делает запрос — берём только из сессии, никогда из тела запроса,
// иначе любой сотрудник мог бы проходить тесты или смотреть кабинет за другого.
// Роль и само существование пользователя проверяем по базе: так удалённый
// сотрудник сразу теряет доступ, а смена роли действует без повторного входа.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as any)?.id;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true, role: true } });
  return user;
}

export const isAdmin = (u: SessionUser) => u.role === "ADMIN" || u.role === "SUPERADMIN";

// Использование: const user = await requireUser(); if (user instanceof NextResponse) return user;
export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Нужно войти в систему" }, { status: 401 });
  return user;
}

export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Нужно войти в систему" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  return user;
}

export async function requireSuperadmin(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Нужно войти в систему" }, { status: 401 });
  if (user.role !== "SUPERADMIN") return NextResponse.json({ error: "Только для суперадминистратора" }, { status: 403 });
  return user;
}
