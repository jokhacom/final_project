import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

// Смена своего пароля из личного кабинета: нужен текущий пароль.
export async function POST(req: NextRequest) {
  const me = await requireUser();
  if (me instanceof NextResponse) return me;

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Введите текущий и новый пароль" }, { status: 400 });
  }
  if (String(newPassword).length < 6) {
    return NextResponse.json({ error: "Новый пароль должен быть не короче 6 символов" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: me.id } });
  if (!user || !(await bcrypt.compare(String(currentPassword), user.passwordHash))) {
    return NextResponse.json({ error: "Текущий пароль неверен" }, { status: 401 });
  }

  await db.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(String(newPassword), 10) } });
  return NextResponse.json({ success: true });
}
