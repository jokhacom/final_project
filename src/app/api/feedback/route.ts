import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";

// Раздел 19: обратная связь. Сохраняется в БД (видно в админ-панели)
// и отправляется на почту mirkomilovjavohir562@gmail.com.
export async function POST(req: NextRequest) {
  const { userId, type, description, screenshotUrl } = await req.json();

  const feedback = await db.feedback.create({
    data: { userId, type, description, screenshotUrl },
  });

  // Отправка письма — требует настроенных SMTP_* переменных в .env.
  // Если они не заданы, письмо не отправится, но обращение уже сохранено в БД.
  try {
    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.FEEDBACK_EMAIL ?? "mirkomilovjavohir562@gmail.com",
        subject: `Новое обращение: ${type}`,
        text: description,
      });
    }
  } catch (e) {
    console.error("Feedback email failed:", e);
  }

  return NextResponse.json({ feedback });
}

export async function GET() {
  const items = await db.feedback.findMany({ orderBy: { createdAt: "desc" }, include: { user: true } });
  return NextResponse.json({ items });
}
