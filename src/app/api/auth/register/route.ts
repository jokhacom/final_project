import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { SUPERADMIN_USERNAME } from "@/lib/auth";

// Раздел 1 запроса: каждый сотрудник входит только по логину и паролю,
// аккаунт сохраняется в базе и не исчезает после перезапуска сайта.
// Роль всегда EMPLOYEE через этот эндпоинт — создание ADMIN/SUPERADMIN
// возможно только вручную через панель существующего SUPERADMIN.
export async function POST(req: NextRequest) {
  const { name, username, password } = await req.json();

  if (!name?.trim() || !username?.trim() || !password) {
    return NextResponse.json({ error: "Заполните имя, логин и пароль" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Пароль должен быть не короче 6 символов" }, { status: 400 });
  }
  if (username.trim().toLowerCase() === SUPERADMIN_USERNAME.toLowerCase()) {
    return NextResponse.json({ error: "Этот логин зарезервирован" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { username: username.trim() } });
  if (existing) {
    return NextResponse.json({ error: "Такой логин уже занят" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.user.create({
    data: { name: name.trim(), username: username.trim(), passwordHash, role: "EMPLOYEE" },
  });

  return NextResponse.json({ user: { id: user.id, name: user.name, username: user.username } });
}
