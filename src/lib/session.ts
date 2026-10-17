import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

export type Role = "EMPLOYEE" | "ADMIN" | "SUPERADMIN";
export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

// Кто делает запрос — берём только из сессии, никогда из тела запроса,
// иначе любой сотрудник мог бы проходить тесты или смотреть кабинет за другого.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) return null;
  return { id: user.id, name: user.name ?? "", role: user.role ?? "EMPLOYEE" };
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
