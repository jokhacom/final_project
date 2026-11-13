import { NextRequest, NextResponse } from "next/server";
import { aiProvider, isReplyChannel, isReplyTone, type AIImage } from "@/lib/ai";
import { assistantAccess, awardAchievement, guardAssistant, loadKnowledge, MAX_CLIENT_MESSAGE, recordAssistantUse } from "@/lib/assistant";
import { toNewAlphabet } from "@/lib/typingWords";
import { describeMasked, maskPII, type PiiKind } from "@/lib/pii";
import { db } from "@/lib/db";
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
  // Личные данные клиента (ФИО, телефон, паспорт, карта, дата рождения…) скрываем ДО ИИ и до сохранения в историю.
  const m1 = maskPII(String(body.message ?? "").trim());
  const m2 = maskPII(String(body.draft ?? "").trim());
  const message = m1.text;
  const draft = m2.text;
  const found = { ...m1.found };
  for (const [k, n] of Object.entries(m2.found) as [PiiKind, number][]) found[k] = (found[k] ?? 0) + n;
  const masked = describeMasked(found);
  const privacy = masked ? { masked, maskedMessage: message, maskedDraft: draft } : {};
  if (message.length > MAX_CLIENT_MESSAGE || draft.length > MAX_CLIENT_MESSAGE) {
    return NextResponse.json({ error: `Текст слишком длинный (больше ${MAX_CLIENT_MESSAGE} символов)` }, { status: 400 });
  }

  let image: AIImage | undefined;
  if (mode === "reply" && body.image) {
    // Скриншоты: только если администратор их не выключил и сотрудник подтвердил, что закрасил личные данные клиента.
    const off = (await db.setting.findUnique({ where: { key: "assistant_screenshots" } }))?.value === "false";
    if (off) return NextResponse.json({ error: "Скриншоты в помощнике выключены администратором — вставьте текст сообщения" }, { status: 400 });
    if (body.imageRedacted !== true) {
      return NextResponse.json({ error: "Сначала закрасьте на скриншоте личные данные клиента и отметьте галочку" }, { status: 400 });
    }
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
      return NextResponse.json({ ...result, ...saved, ...privacy });
    }
    // Тонов можно выбрать несколько; старый вариант — одна строка tone.
    const rawTones: unknown[] = Array.isArray(body.tones) ? body.tones : body.tone ? [body.tone] : [];
    const tones = [...new Set(rawTones.filter(isReplyTone))].filter((t) => t !== "default");
    const tone = tones.join(",") || "default";
    // Куда отвечаем: отзыв (публично) или личное сообщение; оценку 1–5 сотрудник может указать для отзыва.
    const channel = isReplyChannel(body.channel) ? body.channel : undefined;
    const r = Number(body.rating);
    const rating = channel === "review" && Number.isInteger(r) && r >= 1 && r <= 5 ? r : undefined;
    const reply = await aiProvider.generateReply(knowledge.text, message, { tones, image, channel, rating });
    const result = { ...reply, uzNew: toNewAlphabet(reply.uz) };
    const where = channel === "review" ? `⭐ Отзыв${rating ? ` (${rating}★)` : ""}\n` : channel === "dm" ? "💬 Личное сообщение\n" : "";
    const input = where + (image ? `📷 Скриншот переписки${message ? `\n${message}` : ""}` : message);
    const saved = await recordAssistantUse(user, access, { mode, input, tone, result });
    return NextResponse.json({ ...result, ...saved, ...privacy });
  } catch (e) {
    console.error("assistant failed:", e);
    return NextResponse.json({ error: "ИИ не смог ответить — попробуйте ещё раз" }, { status: 502 });
  }
}
