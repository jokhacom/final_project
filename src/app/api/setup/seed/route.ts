import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { SUPERADMIN_USERNAME } from "@/lib/auth";

// Альтернатива команде "npx prisma db seed" для тех, у кого нет удобного
// доступа к терминалу: просто открыть эту ссылку в браузере один раз.
//
// Открыть в браузере:
//   https://ВАШ-САЙТ.vercel.app/api/setup/seed?secret=ВАШ_SETUP_SECRET&password=ВАШ_ПАРОЛЬ
//
// SETUP_SECRET задаётся в Environment Variables на Vercel (придумайте любую
// случайную строку) — без правильного секрета создать администратора нельзя.
// После первого успешного создания эндпоинт сам себя отключает (если
// пользователь javokhir уже существует — возвращает ошибку, а не создаёт заново).
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const password = req.nextUrl.searchParams.get("password");

  if (!process.env.SETUP_SECRET || secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Неверный или отсутствующий secret" }, { status: 403 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Добавьте в ссылку &password=ваш_пароль (не короче 6 символов)" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { username: SUPERADMIN_USERNAME } });
  if (existing) {
    return NextResponse.json({ error: "Суперадминистратор уже создан, этот способ больше не сработает — используйте /api/auth/change-password" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const superadmin = await db.user.create({
    data: { name: "Суперадминистратор", username: SUPERADMIN_USERNAME, passwordHash, role: "SUPERADMIN" },
  });

  await db.setting.createMany({
    data: [
      { key: "daily_quiz_enabled", value: "false" },
      { key: "theme_accent_color", value: "#7C4DFF" },
    ],
    skipDuplicates: true,
  });

  return NextResponse.json({
    success: true,
    message: "Суперадминистратор создан. Логин указан ниже — используйте пароль, который вы указали в ссылке.",
    username: superadmin.username,
  });
}
