import { NextRequest, NextResponse } from "next/server";
import { aiProvider } from "@/lib/ai";
import { AI_NOT_CONFIGURED_MESSAGE, features } from "@/lib/config/features";
import { assistantAccess, loadKnowledge, MAX_CLIENT_MESSAGE } from "@/lib/assistant";
import { db } from "@/lib/db";
import { LIMIT_PERIOD_LABEL } from "@/lib/premium";
import { toNewAlphabet } from "@/lib/typingWords";
import { requireUser } from "@/lib/session";

export const maxDuration = 60;

// Есть ли доступ к «Помощнику ответов» — для меню и страницы (state и срок — чтобы объяснить, почему нет).
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json(await assistantAccess(user));
}

// Готовый ответ клиенту по загруженным шаблонам: русский, узбекский и узбекский на новом алфавите.
// Новый алфавит получаем из узбекского текста по правилам замены букв (без второго запроса к ИИ).
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const access = await assistantAccess(user);
  if (!access.allowed) return NextResponse.json({ error: "Помощник ответов доступен только премиум-пользователям" }, { status: 403 });
  if (access.limit && access.limit.left === 0) {
    const when = { day: "Новые ответы — завтра.", month: "Новые ответы — в следующем месяце.", total: "Чтобы получить ещё, обратитесь к администратору." }[access.limit.period];
    return NextResponse.json(
      { error: `Лимит ответов исчерпан: ${access.limit.limit} ${LIMIT_PERIOD_LABEL[access.limit.period]}. ${when}`, limit: access.limit },
      { status: 429 }
    );
  }
  if (!features.AI_CONFIGURED) return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Вставьте сообщение клиента" }, { status: 400 });
  if (message.length > MAX_CLIENT_MESSAGE) return NextResponse.json({ error: `Сообщение слишком длинное (больше ${MAX_CLIENT_MESSAGE} символов)` }, { status: 400 });

  const knowledge = await loadKnowledge();
  if (!knowledge.count) return NextResponse.json({ error: "Администратор ещё не загрузил шаблоны ответов" }, { status: 400 });

  try {
    const reply = await aiProvider.generateReply(knowledge.text, message);
    // В лимит идут только полученные ответы: ошибка ИИ ответ не «съедает».
    await db.assistantUse.create({ data: { userId: user.id } });
    const limit = access.limit && { ...access.limit, used: access.limit.used + 1, left: access.limit.left - 1 };
    return NextResponse.json({ ...reply, uzNew: toNewAlphabet(reply.uz), limit });
  } catch (e) {
    console.error("assistant reply failed:", e);
    return NextResponse.json({ error: "ИИ не смог составить ответ — попробуйте ещё раз" }, { status: 502 });
  }
}
