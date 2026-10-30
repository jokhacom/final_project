import type { AIImage, AIProvider, CheckedReply, CoachPlan, ContentLanguage, ExtractedRule, GeneratedGameItem, GeneratedLanguageItem, GeneratedQuestion, GeneratedReply, Level, ReplyTone } from "./provider";

// Общие промпты для всех провайдеров. Провайдер отвечает только за то,
// как отправить текст в свою модель и получить текст обратно (complete),
// поэтому Claude, Gemini и OpenAI задают вопросы и проверяют ответы одинаково.
// fast — для разбора документа и создания вопросов/игр: ИИ меньше «размышляет»,
// отвечает быстрее и укладывается в лимит времени функции Vercel (60 с).
// images — картинки к запросу (скриншот переписки для «Помощника ответов»).
export type Complete = (prompt: string, maxTokens: number, opts?: { fast?: boolean; images?: AIImage[] }) => Promise<string>;

const LEVEL_LABEL: Record<Level, string> = {
  BEGINNER: "Новичок — базовые правила, простые формулировки",
  MIDDLE: "Middle — применение правил в типичных ситуациях",
  PROFESSIONAL: "Professional — сложные и конфликтные случаи, нюансы тона",
  EXAM: "Итоговый экзамен — смешанная сложность",
};

// Чем уровни отличаются друг от друга: длина, сложность, доля заданий с вариантами.
const LEVEL_RULES: Record<Level, string> = {
  BEGINNER: `НОВИЧОК (самый лёгкий уровень, сотрудник только начал работать):
- вопрос короткий: одно предложение, до 15 слов; без длинных вступлений и описаний ситуации;
- проверяет ОДНО простое правило напрямую: «Как правильно…?», «Можно ли…?», «Какое слово…?»;
- варианты ответа короткие (до 8 слов), правильный очевиден тому, кто знает правило, неверные — явно неверные;
- примерно 3 из 4 заданий — с вариантами (MULTIPLE_CHOICE/BEST_RESPONSE); открытые — на ответ в одно предложение, FIX_MESSAGE — сообщение в 1–2 предложения с одной явной ошибкой против правила темы (её видит тот, кто знает правило, но не любой человек с улицы).`,
  MIDDLE: `MIDDLE (средний уровень):
- типичная рабочая ситуация в 1–2 предложениях, до 35 слов;
- применить правило к конкретному случаю, а не просто вспомнить его;
- варианты до 15 слов, неверные варианты правдоподобные;
- примерно половина заданий — с вариантами, половина — открытые; FIX_MESSAGE — сообщение в 2 предложения с 1–2 ошибками.`,
  PROFESSIONAL: `PROFESSIONAL (сложный уровень):
- непростой кейс в 2–4 предложениях: конфликтный или эмоциональный клиент, нестандартная ситуация, сразу несколько правил
  (если в теме правил мало — сложность за счёт ситуации и тонких различий вариантов, а не числа правил);
- нюансы тона и формулировок, варианты отличаются тонко;
- больше открытых заданий (OPEN/FIND_ERROR/FIX_MESSAGE), чем с вариантами; FIX_MESSAGE — сообщение в 2–4 предложения с несколькими нарушениями.`,
  EXAM: `ИТОГОВЫЙ ЭКЗАМЕН:
- задания смешанной сложности, от простых до сложных кейсов;
- проверяют умение применить сразу несколько правил;
- примерно половина — с вариантами, половина — открытые.`,
};

// Только загруженный документ: никаких сведений «из головы» ИИ и упоминаний других компаний.
const SOURCE_RULE = `ИСТОЧНИК — ТОЛЬКО правила и текст выше (загруженный документ компании). Строго:
- не добавляй факты, продукты, услуги, тарифы, проценты, сроки, суммы и названия, которых нет в документе;
- не упоминай другие компании, банки, бренды, сервисы, приложения и сайты (даже известные), если их нет в документе; компанию называй так, как в документе, или «наша компания»;
- если в документе для примера упомянута другая компания — не используй её название, передай только правило;
- ситуации с клиентом бери из того, о чём говорит документ; не выдумывай подробности, которых в нём нет;
- даже если правил мало, всё равно составь задания по тем, что есть (можно меньше, чем просили, но хотя бы одно)
  и ответь только JSON-массивом — без объяснений, отказов и текста вне JSON.`;

// Контекст компании: клиенты в Узбекистане, деньги — только в сумах.
const CONTEXT_RULE = `Контекст: компания и её клиенты — в Узбекистане. Все денежные суммы пиши в узбекских сумах: по-русски «сум» (например, 150 000 сум), по-узбекски «so'm» (150 000 so'm). Никогда не используй рубли, доллары и другие валюты, даже если в документе пример в другой валюте.`;

// Правила узбекской орфографии (латиница), как в орфографическом словаре imlo.uz.
const UZ_ORTHOGRAPHY = `узбекском языке латиницей строго по действующим правилам узбекской орфографии (как в орфографическом словаре imlo.uz): буквы oʻ и gʻ пиши со знаком ʻ (например: koʻp, togʻri), разделительный знак — ʼ (tutuq belgisi: maʼlumot, taʼlim, sanʼat), сочетания sh, ch, ng; не смешивай с кириллицей, не вставляй русские слова, если есть узбекские; следи за x/h и q/k (xizmat, hisob, qarz, kerak)`;

function languageRule(language: ContentLanguage = "auto"): string {
  if (language === "ru") return "Язык: пиши всё (текст, варианты, ключевые слова, пояснения) на русском языке, даже если правила на другом языке.";
  if (language === "uz") return `Язык: пиши всё (текст, варианты, ключевые слова, пояснения) на ${UZ_ORTHOGRAPHY}, даже если правила на русском.`;
  return `Язык: пиши на том же языке, что и правила выше. Если правила на узбекском — пиши на ${UZ_ORTHOGRAPHY}. Если на русском — по-русски.`;
}

const QUESTION_FORMAT = `Типы заданий:
- MULTIPLE_CHOICE — вопрос и 4 варианта, один правильный;
- BEST_RESPONSE — ситуация с клиентом и 4 варианта ответа сотрудника, выбрать лучший;
- OPEN — открытый вопрос, сотрудник пишет ответ сам;
- FIND_ERROR — сообщение сотрудника клиенту с ошибкой, нужно найти и назвать ошибку;
- FIX_MESSAGE — сообщение сотрудника, нарушающее правила, нужно переписать его правильно.
Для FIND_ERROR и FIX_MESSAGE: в text сначала коротко задание, затем само сообщение в кавычках, например: «Исправьте ответ клиенту: "…"».
Сообщение ОБЯЗАТЕЛЬНО нарушает конкретное правило этой темы (запрещённое слово или оборот, обращение на «ты», грубый или холодный тон,
канцелярит, неверное оформление суммы или даты, нет нужной информации и т.п.). Нельзя давать сообщение без ошибки или простую
констатацию факта, которую нечего исправлять. В expectedKeywords — слова, которые должны быть в правильном варианте; в explanation — какое правило нарушено.
Соотношение заданий с вариантами и открытых, длину и сложность бери из требований уровня выше.
Формулируй задания как реальные ситуации из работы с клиентами, но только о том, что есть в документе, а не абстрактно.
У каждого задания обязательно explanation — какой ответ верный и почему, со ссылкой на правило.
Ответь строго JSON-массивом без markdown и пояснений:
[{"type":"MULTIPLE_CHOICE","text":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."},
 {"type":"FIX_MESSAGE","text":"...","expectedKeywords":["...","..."],"explanation":"..."}]`;

// Модели иногда оборачивают JSON в ```json или добавляют текст вокруг.
export function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {}
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {}
  }
  // Ответ обрезан на середине (кончился лимит вывода) — забираем все элементы
  // массива, которые успели прийти целиком.
  const salvaged = salvageArray(cleaned.slice(Math.max(start, 0)));
  if (salvaged) return salvaged as T;
  throw new Error("ИИ вернул неполный ответ — попробуйте ещё раз");
}

// Из начала JSON-массива "[{...},{...},{..." оставляет только законченные объекты верхнего уровня.
function salvageArray(text: string): unknown[] | null {
  if (!text.startsWith("[")) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastComplete = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 1 && c === "}") lastComplete = i;
    }
  }
  if (lastComplete < 0) return null;
  try {
    const list = JSON.parse(text.slice(0, lastComplete + 1) + "]");
    return Array.isArray(list) && list.length ? list : null;
  } catch {
    return null;
  }
}

function normalizeQuestions(list: GeneratedQuestion[]): GeneratedQuestion[] {
  return (Array.isArray(list) ? list : []).filter((q) => {
    if (!q?.text || !q.type) return false;
    if (q.type === "MULTIPLE_CHOICE" || q.type === "BEST_RESPONSE") {
      return Array.isArray(q.options) && q.options.length >= 2 && typeof q.correctIndex === "number";
    }
    return ["OPEN", "FIND_ERROR", "FIX_MESSAGE"].includes(q.type);
  });
}

// Файлы «Помощника ответов» в запросе к ИИ.
const knowledgeBlock = (knowledge: string) => `Файлы компании — шаблоны, примеры ответов, правила и обучающие презентации. Опирайся ТОЛЬКО на них:
"""
${knowledge}
"""`;

const REPLY_RULES = `- если в файлах есть подходящий шаблон или пример ответа — бери его за основу и подстрой под сообщение клиента; соблюдай обращение, приветствие и подпись, как в примерах;
- разделы «Правила компании» (если есть) — обязательные правила тона и оформления: ответ не должен их нарушать, а если подходящего шаблона нет — составь ответ по ним;
- факты (сроки, суммы, условия, порядок действий, контакты) — только из файлов; ничего не придумывай и не упоминай другие компании, банки и сервисы;
- ответ вежливый, на «вы», без канцелярита, готов к отправке: без пометок вроде «[имя]», если в шаблоне так не принято`;

const TONE_RULE: Record<ReplyTone, string> = {
  default: "как в шаблонах и примерах компании",
  official: "официальный и сдержанный, полные формулировки, без эмоций и смайликов",
  friendly: "тёплый и дружелюбный, живой язык, но в рамках правил компании",
  short: "максимально коротко: 1–2 предложения, только суть",
  angry: "клиент расстроен или злится: сначала искренне извинись и покажи, что понимаешь его, затем спокойно и конкретно объясни, что будет сделано",
};

export function createProvider(complete: Complete): AIProvider {
  return {
    async extractKnowledge(materialText) {
      const prompt = `Ты анализируешь корпоративный документ или книгу для обучения сотрудников службы поддержки (Редполитика, Tone of Voice, стандарты обслуживания).
Ниже может быть только фрагмент большого документа — разбирай то, что есть во фрагменте.
Фрагмент:
"""
${materialText}
"""

Разбери документ на темы. Для каждой темы выдели конкретные правила одного из типов:
- REQUIRED (обязательное требование)
- FORBIDDEN (запрещённая формулировка/действие)
- RECOMMENDED (рекомендуемая формулировка)
- EXAMPLE_GOOD (пример правильного общения)
- EXAMPLE_BAD (пример неправильного общения)

Правила формулируй понятно для сотрудника, кратко (одно предложение). Выпиши самые важные — не больше 8 тем и 25 правил на фрагмент. Добавь короткую цитату из документа (sourceQuote).
Темы и правила пиши на том же языке, что и документ (не переводи). Узбекский текст — латиницей по правилам современной орфографии (oʻ, gʻ, ʼ).
Название темы — короткое и общее (2–4 слова, например «Обращение к клиенту», «Задолженность и оплата»), чтобы одинаковые темы из разных частей документа совпадали по названию.
НЕ придумывай правила, которых нет в тексте. Если во фрагменте нет правил (оглавление, титульный лист), верни пустой массив [].
Не добавляй в правила названия других компаний, брендов и сервисов: если в документе пример из другой компании — перескажи правило без её названия.

Ответь строго JSON-массивом без markdown:
[{"name":"Название темы","description":"Кратко о теме","rules":[{"type":"REQUIRED","text":"...","sourceQuote":"..."}]}]`;
      return parseJson(await complete(prompt, 12000, { fast: true }));
    },

    async generateQuestionsForTopic(topicName: string, rules: ExtractedRule[], level, count, language) {
      const rulesText = rules
        .map((r, i) => `${i + 1}. [${r.type}] ${r.text}${r.sourceQuote ? ` (источник: "${r.sourceQuote}")` : ""}`)
        .join("\n");
      const prompt = `Ты создаёшь задания для теста сотрудников службы поддержки по теме "${topicName}".
Уровень сложности: ${LEVEL_LABEL[level]}.
${LEVEL_RULES[level]}
${SOURCE_RULE}
${CONTEXT_RULE}

Правила этой темы (используй ТОЛЬКО их, не придумывай новых):
${rulesText}

Создай ${count} заданий, каждое проверяет одно из перечисленных правил.
${languageRule(language)}
${QUESTION_FORMAT}`;
      return normalizeQuestions(parseJson(await complete(prompt, 8000, { fast: true })));
    },

    async generateQuestions(materialText, level, count, ruleContext, language) {
      const ruleBlock = ruleContext
        ? `Создавай задание ИМЕННО по этому правилу:\n"""\n${ruleContext}\n"""\nДокумент ниже — только контекст.`
        : `Создавай задания на основе всего документа ниже.`;
      const prompt = `Ты создаёшь задания для теста сотрудников службы поддержки на основе внутреннего документа компании.
Уровень сложности: ${LEVEL_LABEL[level]}.
${LEVEL_RULES[level]}
${SOURCE_RULE}
${CONTEXT_RULE}
${ruleBlock}

Документ:
"""
${materialText}
"""

Создай ${count} заданий, основанных ТОЛЬКО на содержании документа.
${languageRule(language).replace("правила выше", "документ")}
${QUESTION_FORMAT}`;
      return normalizeQuestions(parseJson(await complete(prompt, 8000, { fast: true })));
    },

    async generateGameItems(topicName, rules, count, language) {
      const rulesText = rules
        .map((r, i) => `${i + 1}. [${r.type}] ${r.text}${r.sourceQuote ? ` (источник: "${r.sourceQuote}")` : ""}`)
        .join("\n");
      const prompt = `Ты делаешь обучающие мини-игры для сотрудников службы поддержки по теме "${topicName}".
Правила темы (используй ТОЛЬКО их):
${rulesText}

Создай ${count} элементов игры «Можно или нельзя?» (kind: TRUE_FALSE): короткая реплика сотрудника клиенту (1–2 предложения, как в реальном чате), isCorrect — можно ли так ответить по правилам. Примерно половина допустимых, половина с нарушением правила.
И ${count} заданий «Найди и исправь ошибку» (kind: FIX_ERROR): prompt — сообщение сотрудника клиенту (1–3 предложения, как в чате) с одним-двумя нарушениями правил, answer — это же сообщение, написанное правильно.
У каждого элемента explanation — одно предложение, почему так, со ссылкой на правило.
${SOURCE_RULE}
${CONTEXT_RULE}
${languageRule(language)}
Ответь строго JSON-массивом без markdown:
[{"kind":"TRUE_FALSE","prompt":"...","isCorrect":false,"explanation":"..."},
 {"kind":"FIX_ERROR","prompt":"...","answer":"...","explanation":"..."}]`;
      const list = parseJson<GeneratedGameItem[]>(await complete(prompt, 8000, { fast: true }));
      return (Array.isArray(list) ? list : []).filter(
        (g) =>
          g?.prompt &&
          ((g.kind === "TRUE_FALSE" && typeof g.isCorrect === "boolean") || (g.kind === "FIX_ERROR" && !!g.answer))
      );
    },

    async generateLanguageItems(language, count, avoid) {
      const ru = language === "ru";
      const topics = ru
        ? "предлоги и падежи (в течение, по приезде, согласно чему), слитное/раздельное/дефисное написание (также/так же, вследствие, по-русски, кто-нибудь), НЕ и НИ, -тся/-ться, суффиксы (-ик/-ек, -чик/-щик, -н-/-нн-), приставки (без-/бес-, пре-/при-), окончания и формы слов, орфография частых слов из переписки с клиентом, похожие слова (предоставить/представить, надеть/одеть), пунктуация (обращение, вводные слова), ударение"
        : "tutuq belgisi (maʼlumot, taʼlim), oʻ va gʻ harflari, x va h (xizmat, hisob), qoʻshimchalar va tovush oʻzgarishi (yurak — yuragi, qishloq — qishlogʻi, -ga/-ka/-qa, -gan/-kan/-qan), qoʻshib yozish (qabulxona, -mi, -dir), ajratib yozish (hech kim, har bir, sotib ol), chiziqcha bilan yozish (ota-ona, tez-tez, 2024-yil), bosh harf (oy nomlari kichik harf bilan), qoʻsh harflar (murojaat, tashakkur)";
      const prompt = `Ты составляешь короткие вопросы для игры «Грамотность» для сотрудников службы поддержки. На каждый вопрос даётся 10 секунд, поэтому вопрос и варианты — очень короткие.
Язык игры: ${ru ? "русский язык (нормы современного русского литературного языка)" : UZ_ORTHOGRAPHY.replace("узбекском языке", "узбекский язык")}.
${ru ? "Всё (вопрос, варианты, раздел, пояснение) пиши по-русски." : "Всё (вопрос, варианты, раздел, пояснение) пиши на узбекском языке латиницей. Проверяй каждое слово по правилам «Oʻzbek tilining asosiy imlo qoidalari» и словарю imlo.uz; если не уверен в норме — не используй это слово."}
Разделы: ${topics}.
Создай ${count} вопросов из разных разделов. У каждого: category — раздел, prompt — вопрос (например «${ru ? "Как правильно?" : "Qaysi biri toʻgʻri yozilgan?"}» или фраза с пропуском ___), options — 2–4 варианта, ровно один правильный, correctIndex — номер правильного (с 0), explanation — одно короткое предложение с правилом.
Только бесспорные нормы, без спорных и устаревших вариантов. Слова и фразы — из реальной переписки с клиентами (платёж, заявка, справка, обращение).
Не повторяй эти вопросы:
${avoid.join("\n") || "—"}
Ответь строго JSON-массивом без markdown:
[{"category":"...","prompt":"...","options":["...","..."],"correctIndex":0,"explanation":"..."}]`;
      const list = parseJson<GeneratedLanguageItem[]>(await complete(prompt, 6000, { fast: true }));
      return (Array.isArray(list) ? list : []).filter(
        (q) => q?.prompt && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length
      );
    },

    async generateReply(knowledge, clientMessage, opts) {
      const tone = opts?.tone ?? "default";
      const clientBlock = opts?.image
        ? `Сообщение клиента — на скриншоте переписки (картинка приложена). Прочитай переписку и отвечай на ПОСЛЕДНИЕ сообщения клиента.${
            clientMessage ? `\nПояснение сотрудника:\n"""\n${clientMessage}\n"""` : ""
          }`
        : `Сообщение клиента:\n"""\n${clientMessage}\n"""`;
      const prompt = `Ты — опытный сотрудник службы поддержки компании. Тебе пишет клиент, нужно составить готовый ответ, который сотрудник отправит клиенту.
${knowledgeBlock(knowledge)}

${clientBlock}

Как составить ответ:
${REPLY_RULES}
- тон: ${TONE_RULE[tone]};
- если в файлах нет ответа на вопрос клиента — found: false; ru и uz тогда — вежливый короткий ответ без выдуманных фактов (например, уточнить детали или сказать, что вопрос передан специалисту), а в note — чего не хватает в файлах;
- ru — на русском языке; uz — тот же ответ на ${UZ_ORTHOGRAPHY}; оба по смыслу одинаковые;
- note — одно короткое предложение для сотрудника по-русски: на какой шаблон или правило опирался ответ.
${CONTEXT_RULE}
Ответь строго JSON без markdown:
{"found": true, "ru": "...", "uz": "...", "note": "..."}`;
      const parsed = parseJson<Partial<GeneratedReply>>(await complete(prompt, 3000, opts?.image ? { images: [opts.image] } : undefined));
      if (!parsed?.ru || !parsed?.uz) throw new Error("ИИ не вернул ответ");
      return { found: parsed.found !== false, ru: String(parsed.ru).trim(), uz: String(parsed.uz).trim(), note: parsed.note ? String(parsed.note) : undefined };
    },

    async checkReply(knowledge, clientMessage, draft) {
      const prompt = `Ты — наставник сотрудника службы поддержки. Сотрудник написал ответ клиенту и просит проверить его перед отправкой.
${knowledgeBlock(knowledge)}

${clientMessage ? `Сообщение клиента:\n"""\n${clientMessage}\n"""\n\n` : ""}Ответ сотрудника (черновик):
"""
${draft}
"""

Проверь черновик ТОЛЬКО по правилам и шаблонам из файлов выше, а также на орфографию и грамматику (русский — по нормам литературного языка; узбекский — по правилам imlo.uz, простой апостроф вместо ʻ ошибкой не считай):
- issues — каждое нарушение: quote — точный фрагмент из черновика, problem — что не так (коротко, по-русски), rule — какое правило из файлов нарушено (или «Орфография», «Грамматика»);
- не придирайся к тому, чего нет в правилах; если черновик хороший — verdict: "good" и пустой issues;
- fixed — исправленный ответ, готовый к отправке, на ТОМ ЖЕ языке, что черновик; сохрани смысл и всё верное, что написал сотрудник; факты — только из черновика и файлов;
- comment — 1–2 предложения для сотрудника по-русски, на «вы»: что получилось хорошо и что главное исправить.
${CONTEXT_RULE}
Ответь строго JSON без markdown:
{"verdict": "fix", "issues": [{"quote": "...", "problem": "...", "rule": "..."}], "fixed": "...", "comment": "..."}`;
      const parsed = parseJson<Partial<CheckedReply>>(await complete(prompt, 3000));
      const issues = (Array.isArray(parsed?.issues) ? parsed.issues : [])
        .filter((i) => i && (i.problem || i.quote))
        .map((i) => ({ quote: String(i.quote ?? ""), problem: String(i.problem ?? ""), rule: String(i.rule ?? "") }));
      return {
        verdict: issues.length || parsed?.verdict === "fix" ? "fix" : "good",
        issues,
        fixed: String(parsed?.fixed ?? draft).trim(),
        comment: String(parsed?.comment ?? ""),
      };
    },

    async coachPlan(mistakes, rules) {
      const prompt = `Ты — личный тренер сотрудника службы поддержки. Вот его ошибки в тестах (вопрос, его ответ, правильный ответ, пояснение):
"""
${mistakes}
"""

Правила компании по темам, где он ошибается (используй ТОЛЬКО их):
"""
${rules || "—"}
"""

Составь короткий персональный план:
- summary — 1–2 предложения по-русски, на «вы», дружелюбно: в чём главная трудность;
- focus — 2–4 правила, которые стоит повторить: rule — само правило коротко, why — почему это важно для него (по его ошибкам), tip — короткий совет или пример, как запомнить;
- exercises — 5 новых коротких заданий с вариантами ответа именно по этим правилам (не повторяй вопросы из ошибок): question, options (3–4 коротких варианта), correctIndex (с 0), explanation — одно предложение с правилом.
Задания на том же языке, что вопросы в ошибках. Не добавляй фактов, которых нет в правилах и ошибках, и не упоминай другие компании.
${CONTEXT_RULE}
Ответь строго JSON без markdown:
{"summary": "...", "focus": [{"rule": "...", "why": "...", "tip": "..."}], "exercises": [{"question": "...", "options": ["...", "..."], "correctIndex": 0, "explanation": "..."}]}`;
      const parsed = parseJson<Partial<CoachPlan>>(await complete(prompt, 4000, { fast: true }));
      const exercises = (Array.isArray(parsed?.exercises) ? parsed.exercises : []).filter(
        (q) => q?.question && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length
      );
      const focus = (Array.isArray(parsed?.focus) ? parsed.focus : []).filter((f) => f?.rule);
      if (!focus.length && !exercises.length) throw new Error("ИИ не вернул план");
      return { summary: String(parsed?.summary ?? ""), focus, exercises };
    },

    async gradeOpenAnswer(question, expectedKeywords, answer, materialContext) {
      const contextBlock = materialContext
        ? `Фрагмент обучающего материала, на основе которого задан вопрос. Проверяй ответ СТРОГО по нему, а не по общим знаниям:
"""
${materialContext.slice(0, 8000)}
"""`
        : `Материал к вопросу не привязан — ориентируйся на ожидаемые темы ниже.`;
      const prompt = `Оцени ответ сотрудника на задание корпоративного теста.
${contextBlock}

Задание: "${question}"
Ожидаемые темы (вспомогательно, не обязательно дословно): ${expectedKeywords.join(", ") || "—"}
Ответ сотрудника: "${answer}"

Если ответ сотрудника на узбекском — орфографические ошибки считай по правилам современной узбекской орфографии (imlo.uz, латиница); простой апостроф вместо ʻ (o', g') ошибкой не считай. Комментарий пиши на языке ответа сотрудника.
Оцени смысловую правильность строго по материалу (перефразированный правильный ответ засчитывается), посчитай орфографические и грамматические ошибки в ответе.
В комментарии (2–4 предложения, обращение на «вы») объясни, ПОЧЕМУ ответ принят или нет, со ссылкой на конкретное правило, и каким должен быть правильный ответ. Если в материале нет подходящего правила — так и напиши.
Ответь строго JSON без markdown:
{"correct": true, "spellingErrors": 0, "grammarErrors": 0, "comment": "..."}`;
      const parsed = parseJson<any>(await complete(prompt, 2000));
      return {
        correct: !!parsed.correct,
        spellingErrors: Math.max(0, Number(parsed.spellingErrors) || 0),
        grammarErrors: Math.max(0, Number(parsed.grammarErrors) || 0),
        comment: String(parsed.comment ?? ""),
      };
    },
  };
}
