import { db } from "./db";
import { premiumState, type PremiumState } from "./premium";
import { isAdmin, type SessionUser } from "./session";

// «Помощник ответов»: доступ — у администраторов и у сотрудников с действующим премиумом.
export async function assistantAccess(user: SessionUser) {
  if (isAdmin(user)) return { allowed: true, state: "active" as PremiumState, from: null, until: null };
  const row = await db.user.findUnique({ where: { id: user.id }, select: { premium: true, premiumFrom: true, premiumUntil: true } });
  const state = row ? premiumState(row) : "off";
  return { allowed: state === "active", state, from: row?.premiumFrom ?? null, until: row?.premiumUntil ?? null };
}

// Сколько текста файлов отправляем ИИ за один ответ (~100 тыс. токенов). Больше — дорого и медленно.
export const MAX_KNOWLEDGE_CHARS = 400_000;
export const MAX_CLIENT_MESSAGE = 3000;

// Все файлы одним текстом, с названиями — чтобы ИИ видел, где какой шаблон.
export async function loadKnowledge() {
  const docs = await db.replyDoc.findMany({ orderBy: { createdAt: "asc" }, select: { title: true, content: true } });
  const text = docs.map((d) => `=== ${d.title} ===\n${d.content.trim()}`).join("\n\n");
  return { count: docs.length, text: text.slice(0, MAX_KNOWLEDGE_CHARS), truncated: text.length > MAX_KNOWLEDGE_CHARS };
}
