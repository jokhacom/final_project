import { db } from "./db";
import { isAdmin, type SessionUser } from "./session";

// «Помощник ответов»: доступ — у администраторов и у сотрудников с отметкой «Премиум».
export async function canUseAssistant(user: SessionUser) {
  if (isAdmin(user)) return true;
  const row = await db.user.findUnique({ where: { id: user.id }, select: { premium: true } });
  return !!row?.premium;
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
