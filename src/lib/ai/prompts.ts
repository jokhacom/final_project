import type { AIProvider, ExtractedRule, GeneratedGameItem, GeneratedQuestion, Level } from "./provider";

// Общие промпты для всех провайдеров. Провайдер отвечает только за то,
// как отправить текст в свою модель и получить текст обратно (complete),
// поэтому Claude, Gemini и OpenAI задают вопросы и проверяют ответы одинаково.
// fast — для разбора документа и создания вопросов/игр: ИИ меньше «размышляет»,
// отвечает быстрее и укладывается в лимит времени функции Vercel (60 с).
export type Complete = (prompt: string, maxTokens: number, opts?: { fast?: boolean }) => Promise<string>;

const LEVEL_LABEL: Record<Level, string> = {
  BEGINNER: "Новичок — базовые правила, простые формулировки",
  MIDDLE: "Middle — применение правил в типичных ситуациях",
  PROFESSIONAL: "Professional — сложные и конфликтные случаи, нюансы тона",
  EXAM: "Итоговый экзамен — смешанная сложность",
};

const QUESTION_FORMAT = `Типы заданий:
- MULTIPLE_CHOICE — вопрос и 4 варианта, один правильный;
- BEST_RESPONSE — ситуация с клиентом и 4 варианта ответа сотрудника, выбрать лучший;
- OPEN — открытый вопрос, сотрудник пишет ответ сам;
- FIND_ERROR — сообщение сотрудника клиенту с ошибкой, нужно найти и назвать ошибку;
- FIX_MESSAGE — сообщение сотрудника, нарушающее правила, нужно переписать его правильно.
Примерно половина заданий — с вариантами (MULTIPLE_CHOICE/BEST_RESPONSE), половина — с ответом своими словами (OPEN/FIND_ERROR/FIX_MESSAGE).
Формулируй задания как реальные кейсы обслуживания клиентов (задолженность, тарифы, жалобы, хейт и т.п.), а не абстрактно.
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
Название темы — короткое и общее (2–4 слова, например «Обращение к клиенту», «Задолженность и оплата»), чтобы одинаковые темы из разных частей документа совпадали по названию.
НЕ придумывай правила, которых нет в тексте. Если во фрагменте нет правил (оглавление, титульный лист), верни пустой массив [].

Ответь строго JSON-массивом без markdown:
[{"name":"Название темы","description":"Кратко о теме","rules":[{"type":"REQUIRED","text":"...","sourceQuote":"..."}]}]`;
      return parseJson(await complete(prompt, 12000, { fast: true }));
    },

    async generateQuestionsForTopic(topicName: string, rules: ExtractedRule[], level, count) {
      const rulesText = rules
        .map((r, i) => `${i + 1}. [${r.type}] ${r.text}${r.sourceQuote ? ` (источник: "${r.sourceQuote}")` : ""}`)
        .join("\n");
      const prompt = `Ты создаёшь задания для теста сотрудников службы поддержки по теме "${topicName}".
Уровень сложности: ${LEVEL_LABEL[level]}.

Правила этой темы (используй ТОЛЬКО их, не придумывай новых):
${rulesText}

Создай ${count} заданий, каждое проверяет одно из перечисленных правил.
${QUESTION_FORMAT}`;
      return normalizeQuestions(parseJson(await complete(prompt, 8000, { fast: true })));
    },

    async generateQuestions(materialText, level, count, ruleContext) {
      const ruleBlock = ruleContext
        ? `Создавай задание ИМЕННО по этому правилу:\n"""\n${ruleContext}\n"""\nДокумент ниже — только контекст.`
        : `Создавай задания на основе всего документа ниже.`;
      const prompt = `Ты создаёшь задания для теста сотрудников службы поддержки на основе внутреннего документа компании.
Уровень сложности: ${LEVEL_LABEL[level]}.
${ruleBlock}

Документ:
"""
${materialText}
"""

Создай ${count} заданий, основанных ТОЛЬКО на содержании документа.
${QUESTION_FORMAT}`;
      return normalizeQuestions(parseJson(await complete(prompt, 8000, { fast: true })));
    },

    async generateGameItems(topicName, rules, count) {
      const rulesText = rules
        .map((r, i) => `${i + 1}. [${r.type}] ${r.text}${r.sourceQuote ? ` (источник: "${r.sourceQuote}")` : ""}`)
        .join("\n");
      const prompt = `Ты делаешь обучающие мини-игры для сотрудников службы поддержки по теме "${topicName}".
Правила темы (используй ТОЛЬКО их):
${rulesText}

Создай ${count} элементов игры «Можно или нельзя?» (kind: TRUE_FALSE): короткая реплика сотрудника клиенту (1–2 предложения, как в реальном чате), isCorrect — можно ли так ответить по правилам. Примерно половина допустимых, половина с нарушением правила.
И ${count} карточек (kind: FLASHCARD): prompt — короткая ситуация с клиентом, answer — как правильно поступить или ответить (1–2 предложения).
У каждого элемента explanation — одно предложение, почему так, со ссылкой на правило.
Ответь строго JSON-массивом без markdown:
[{"kind":"TRUE_FALSE","prompt":"...","isCorrect":false,"explanation":"..."},
 {"kind":"FLASHCARD","prompt":"...","answer":"...","explanation":"..."}]`;
      const list = parseJson<GeneratedGameItem[]>(await complete(prompt, 6000, { fast: true }));
      return (Array.isArray(list) ? list : []).filter(
        (g) =>
          g?.prompt &&
          ((g.kind === "TRUE_FALSE" && typeof g.isCorrect === "boolean") || (g.kind === "FLASHCARD" && !!g.answer))
      );
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
