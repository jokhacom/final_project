import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { validateNewUser } from "@/lib/users";
import { getUserLimit } from "@/lib/testSettings";

// Раздел 1 запроса: каждый сотрудник входит только по логину и паролю,
// аккаунт сохраняется в базе и не исчезает после перезапуска сайта.
// Роль всегда EMPLOYEE через этот эндпоинт — создание ADMIN/SUPERADMIN
// возможно только вручную через панель существующего SUPERADMIN.
export async function POST(req: NextRequest) {
  try {
    const { name, username, password } = await req.json();

    const invalid = validateNewUser(name, username, password);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    // Лимит пользователей сайта задаёт суперадминистратор на «Обзоре».
    const limit = await getUserLimit();
    if (limit && (await db.user.count({ where: { role: { not: "SUPERADMIN" } } })) >= limit) {
      return NextResponse.json({ error: "Регистрация закрыта: достигнут лимит пользователей. Обратитесь к администратору." }, { status: 403 });
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
  } catch (e) {
    console.error("Register failed:", e);
    return NextResponse.json({ error: "Не удалось зарегистрироваться. Попробуйте ещё раз позже." }, { status: 500 });
  }
}
