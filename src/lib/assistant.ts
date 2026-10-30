import { db } from "./db";
import { isLimitPeriod, limitPeriodStart, premiumState, type LimitPeriod, type PremiumState } from "./premium";
import { isAdmin, type SessionUser } from "./session";

// Сколько ответов осталось по лимиту премиума (null — без лимита).
export type AssistantLimit = { limit: number; period: LimitPeriod; used: number; left: number } | null;

export async function usageLimit(u: { id: string; premiumFrom: string | null; premiumLimit: number | null; premiumLimitPeriod: string }): Promise<AssistantLimit> {
  if (u.premiumLimit === null) return null;
  const period = isLimitPeriod(u.premiumLimitPeriod) ? u.premiumLimitPeriod : "day";
  const used = await db.assistantUse.count({ where: { userId: u.id, createdAt: { gte: limitPeriodStart(period, u.premiumFrom) } } });
  return { limit: u.premiumLimit, period, used, left: Math.max(0, u.premiumLimit - used) };
}

// «Помощник ответов»: доступ — у администраторов (без лимита) и у сотрудников с действующим премиумом.
export async function assistantAccess(user: SessionUser) {
  if (isAdmin(user)) return { allowed: true, state: "active" as PremiumState, from: null, until: null, limit: null as AssistantLimit };
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, premium: true, premiumFrom: true, premiumUntil: true, premiumLimit: true, premiumLimitPeriod: true },
  });
  const state = row ? premiumState(row) : "off";
  const limit = row && state === "active" ? await usageLimit(row) : null;
  return { allowed: state === "active", state, from: row?.premiumFrom ?? null, until: row?.premiumUntil ?? null, limit };
}

// Сколько текста файлов отправляем ИИ за один ответ (~100 тыс. токенов). Больше — дорого и медленно.
export const MAX_KNOWLEDGE_CHARS = 400_000;
export const MAX_CLIENT_MESSAGE = 3000;

// Брать ли в помощник ещё и документы из «Материалов» (Редполитика и т. п.) и презентации из «Обучения». По умолчанию — да.
export const USE_MATERIALS_KEY = "assistant_use_materials";
export const USE_PRESENTATIONS_KEY = "assistant_use_presentations";
async function settingOn(key: string) {
  const s = await db.setting.findUnique({ where: { key } });
  return s?.value !== "false";
}
export const useMaterials = () => settingOn(USE_MATERIALS_KEY);
export const usePresentations = () => settingOn(USE_PRESENTATIONS_KEY);

// Действующие документы «Материалов» с текстом (старые версии не берём).
export const activeMaterials = () =>
  db.material.findMany({ where: { isActive: true, content: { not: null } }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, content: true } });

// Презентации «Обучения» в порядке раздела; text: null — текст ещё не прочитан (загружены до появления этой функции).
export const learningPresentations = () =>
  db.presentation.findMany({ orderBy: [{ order: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, fileName: true, text: true } });

// Все файлы одним текстом, с названиями — чтобы ИИ видел, где какой шаблон.
// Порядок: шаблоны помощника, документы «Материалов», презентации «Обучения» — при лимите обрезается конец, шаблоны остаются.
export async function loadKnowledge() {
  const docs = await db.replyDoc.findMany({ orderBy: { createdAt: "asc" }, select: { title: true, content: true } });
  const materials = (await useMaterials()) ? await activeMaterials() : [];
  const presentations = (await usePresentations()) ? (await learningPresentations()).filter((p) => p.text) : [];
  const parts = [
    ...docs.map((d) => `=== Шаблоны и примеры ответов: ${d.title} ===\n${d.content.trim()}`),
    ...materials.map((m) => `=== Правила компании: ${m.title} ===\n${(m.content ?? "").trim()}`),
    ...presentations.map((p) => `=== Обучающая презентация: ${p.title} ===\n${p.text}`),
  ];
  const text = parts.join("\n\n");
  return { count: parts.length, text: text.slice(0, MAX_KNOWLEDGE_CHARS), truncated: text.length > MAX_KNOWLEDGE_CHARS };
}
