// Флаги функций.

type Provider = "anthropic" | "gemini" | "openai";

const AI_PROVIDER: Provider = (process.env.AI_PROVIDER as Provider) || "anthropic";

// Переменная с ключом для каждого провайдера. ИИ считается подключённым,
// как только для выбранного провайдера задан ключ — больше ничего менять не нужно.
export const AI_KEY_ENV: Record<Provider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
};

const AI_CONFIGURED = !!process.env[AI_KEY_ENV[AI_PROVIDER]];

export const features = {
  // Авторизация по логину/паролю обязательна для всех сотрудников с первого дня.
  AUTH_ENABLED: true,

  // Даёт возможность суперадминистратору включать ежедневный мини-тест (3 вопроса).
  DAILY_QUIZ_ENABLED: false,

  // Выбор AI-провайдера для генерации вопросов и проверки открытых ответов.
  AI_PROVIDER,

  // Задан ли ключ выбранного провайдера. Без ключа сайт полностью работает:
  // вопросы добавляются вручную или импортом из Excel, ответы проверяются по ключевым словам.
  AI_CONFIGURED,

  // Проверка открытых ответов: "ai" — по смыслу и по материалам, "keyword" — по
  // ключевым словам. По умолчанию "ai", если ИИ подключён, иначе "keyword".
  // Явное GRADING_MODE=keyword оставляет проверку без ИИ даже при наличии ключа.
  GRADING_MODE: ((process.env.GRADING_MODE as "keyword" | "ai") || (AI_CONFIGURED ? "ai" : "keyword")) as "keyword" | "ai",
};

export const AI_NOT_CONFIGURED_MESSAGE = `ИИ не подключён: добавьте ${AI_KEY_ENV[AI_PROVIDER]} в переменные окружения Vercel и сделайте Redeploy`;
