import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";

const TYPES = ["ошибка", "предложение", "вопрос", "другое"];

// Обратная связь. Сохраняется в БД (видно в админ-панели) и, если настроен
// SMTP, дублируется на почту FEEDBACK_EMAIL.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await req.json();
  const type = TYPES.includes(body.type) ? body.type : "другое";
  const description = String(body.description ?? "").trim().slice(0, 4000);
  if (!description) return NextResponse.json({ error: "Опишите обращение" }, { status: 400 });

  const feedback = await db.feedback.create({ data: { userId: user.id, type, description } });

  try {
    if (process.env.SMTP_HOST && process.env.FEEDBACK_EMAIL) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.FEEDBACK_EMAIL,
        subject: `Тренажер ГЦО — новое обращение: ${type}`,
        text: `От: ${user.name}\n\n${description}`,
      });
    }
  } catch (e) {
    console.error("Feedback email failed:", e);
  }

  return NextResponse.json({ feedback: { id: feedback.id } });
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const items = await db.feedback.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, username: true } } },
  });
  return NextResponse.json({ items });
}
