import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const db = new PrismaClient();

// Раздел 2 запроса: единственный Суперадминистратор, логин "javokhir".
// Пароль не прописывается в коде — генерируется случайно один раз при первом
// запуске и выводится в консоль. Суперадминистратор обязан сразу сменить его
// через POST /api/auth/change-password (см. этот эндпоинт).
async function main() {
  const username = "javokhir";

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    console.log("Суперадминистратор уже существует, пароль не менялся:", existing.id);
    return;
  }

  const tempPassword = crypto.randomBytes(9).toString("base64url"); // случайный временный пароль
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const superadmin = await db.user.create({
    data: {
      name: "Суперадминистратор",
      username,
      passwordHash,
      role: "SUPERADMIN",
    },
  });

  console.log("========================================");
  console.log("Создан Суперадминистратор");
  console.log("Логин:", username);
  console.log("Временный пароль:", tempPassword);
  console.log("СРАЗУ смените его через POST /api/auth/change-password");
  console.log("Этот пароль больше нигде не сохранён — запишите его сейчас.");
  console.log("========================================");

  await db.setting.createMany({
    data: [
      { key: "daily_quiz_enabled", value: "false" },
      { key: "theme_accent_color", value: "#7C4DFF" },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
