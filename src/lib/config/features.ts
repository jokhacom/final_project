// Флаги функций.

export type Provider = "anthropic" | "gemini" | "openai";

const PROVIDER_NAMES: Provider[] = ["gemini", "anthropic", "openai"];
const AI_PROVIDER: Provider = PROVIDER_NAMES.includes(process.env.AI_PROVIDER as Provider)
  ? (process.env.AI_PROVIDER as Provider)
  : "anthropic";

// Переменная с ключом для каждого провайдера.
export const AI_KEY_ENV: Record<Provider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
};

export const PROVIDER_LABEL: Record<Provider, string> = {
  gemini: "Gemini",
  anthropic: "Claude",
  openai: "OpenAI",
};

const hasKey = (p: Provider) => !!process.env[AI_KEY_ENV[p]];

// Цепочка провайдеров: сначала основной (AI_PROVIDER), затем запасные — все
// остальные, для которых задан ключ. Если основной не ответил (закончился
// бесплатный лимит, сбой), запрос автоматически уходит следующему.
const AI_CHAIN: Provider[] = [AI_PROVIDER, ...PROVIDER_NAMES.filter((p) => p !== AI_PROVIDER)].filter(hasKey);

const AI_CONFIGURED = AI_CHAIN.length > 0;

export const features = {
  // Авторизация по логину/паролю обязательна для всех сотрудников с первого дня.
  AUTH_ENABLED: true,

  // Даёт возможность суперадминистратору включать ежедневный мини-тест (3 вопроса).
  DAILY_QUIZ_ENABLED: false,

  // Основной AI-провайдер и цепочка с запасными.
  AI_PROVIDER,
  AI_CHAIN,

  // Задан ли ключ хотя бы одного провайдера. Без ключа сайт полностью работает:
  // вопросы добавляются вручную или импортом из Excel, ответы проверяются по ключевым словам.
  AI_CONFIGURED,

  // Проверка открытых ответов: "ai" — по смыслу и по материалам, "keyword" — по
  // ключевым словам. По умолчанию "ai", если ИИ подключён, иначе "keyword".
  // Явное GRADING_MODE=keyword оставляет проверку без ИИ даже при наличии ключа.
  GRADING_MODE: ((process.env.GRADING_MODE as "keyword" | "ai") || (AI_CONFIGURED ? "ai" : "keyword")) as "keyword" | "ai",
};

export const AI_NOT_CONFIGURED_MESSAGE = `ИИ не подключён: добавьте ${AI_KEY_ENV[AI_PROVIDER]} в переменные окружения Vercel и сделайте Redeploy`;
