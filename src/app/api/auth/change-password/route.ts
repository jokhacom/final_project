import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

// Смена пароля по текущему логину/паролю. Используется суперадминистратором
// сразу после первого запуска (см. вывод prisma/seed.ts), и доступна любому
// сотруднику для смены собственного пароля.
export async function POST(req: NextRequest) {
  const { username, currentPassword, newPassword } = await req.json();

  if (!username || !currentPassword || !newPassword) {
    return NextResponse.json({ error: "Заполните логин, текущий и новый пароль" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Новый пароль должен быть не короче 6 символов" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Текущий пароль неверен" }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ success: true });
}
