import { NextRequest, NextResponse } from "next/server";
import { aiProvider, isReplyTone, type AIImage } from "@/lib/ai";
import { assistantAccess, awardAchievement, guardAssistant, loadKnowledge, MAX_CLIENT_MESSAGE, recordAssistantUse } from "@/lib/assistant";
import { toNewAlphabet } from "@/lib/typingWords";
import { requireUser } from "@/lib/session";

export const maxDuration = 60;

// Есть ли доступ к «Помощнику ответов» — для меню, кабинета и страницы (state и срок — чтобы объяснить, почему нет).
// Сотруднику с действующим премиумом заодно выдаём достижение «⭐ Премиум».
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const access = await assistantAccess(user);
  if (access.premium) await awardAchievement(user.id, "premium");
  return NextResponse.json(access);
}

const MAX_IMAGE_CHARS = 4_000_000; // ~3 МБ картинки; браузер заранее сжимает скриншот до 1600px
const IMAGE_DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

// mode "reply" — готовый ответ клиенту: русский, узбекский и узбекский на новом алфавите (из узбекского заменой букв,
// без второго запроса к ИИ); можно приложить скриншот переписки и выбрать тон.
// mode "check" — «Проверь мой ответ»: ошибки в черновике сотрудника и исправленный вариант.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const access = await guardAssistant(user);
  if (access instanceof NextResponse) return access;

  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "check" ? "check" : "reply";
  const message = String(body.message ?? "").trim();
  const draft = String(body.draft ?? "").trim();
  if (message.length > MAX_CLIENT_MESSAGE || draft.length > MAX_CLIENT_MESSAGE) {
    return NextResponse.json({ error: `Текст слишком длинный (больше ${MAX_CLIENT_MESSAGE} символов)` }, { status: 400 });
  }

  let image: AIImage | undefined;
  if (mode === "reply" && body.image) {
    const m = String(body.image).match(IMAGE_DATA_URL);
    if (!m || body.image.length > MAX_IMAGE_CHARS) return NextResponse.json({ error: "Скриншот не подходит: нужна картинка PNG или JPG до 3 МБ" }, { status: 400 });
    image = { mimeType: m[1], data: m[2] };
  }
  if (mode === "reply" && !message && !image) return NextResponse.json({ error: "Вставьте сообщение клиента или скриншот переписки" }, { status: 400 });
  if (mode === "check" && !draft) return NextResponse.json({ error: "Вставьте свой ответ клиенту" }, { status: 400 });

  const knowledge = await loadKnowledge();
  if (!knowledge.count) return NextResponse.json({ error: "Администратор ещё не загрузил шаблоны ответов" }, { status: 400 });

  try {
    if (mode === "check") {
      const result = await aiProvider.checkReply(knowledge.text, message, draft);
      const saved = await recordAssistantUse(user, access, { mode, input: message, draft, result }, result.verdict === "good" ? ["clean_reply"] : []);
      return NextResponse.json({ ...result, ...saved });
    }
    const tone = isReplyTone(body.tone) ? body.tone : "default";
    const reply = await aiProvider.generateReply(knowledge.text, message, { tone, image });
    const result = { ...reply, uzNew: toNewAlphabet(reply.uz) };
    const input = image ? `📷 Скриншот переписки${message ? `\n${message}` : ""}` : message;
    const saved = await recordAssistantUse(user, access, { mode, input, tone, result });
    return NextResponse.json({ ...result, ...saved });
  } catch (e) {
    console.error("assistant failed:", e);
    return NextResponse.json({ error: "ИИ не смог ответить — попробуйте ещё раз" }, { status: 502 });
  }
}
