import type { AIProvider, ExtractedRule, GeneratedQuestion, Level } from "./provider";

// Общие промпты для всех провайдеров. Провайдер отвечает только за то,
// как отправить текст в свою модель и получить текст обратно (complete),
// поэтому Claude, Gemini и OpenAI задают вопросы и проверяют ответы одинаково.
export type Complete = (prompt: string, maxTokens: number) => Promise<string>;

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
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("ИИ вернул ответ не в формате JSON");
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
      const prompt = `Ты анализируешь внутренний корпоративный документ (Red Policy / Tone of Voice / стандарты обслуживания).
Документ:
"""
${materialText}
"""

Разбери документ на темы. Для каждой темы выдели конкретные правила одного из типов:
- REQUIRED (обязательное требование)
- FORBIDDEN (запрещённая формулировка/действие)
- RECOMMENDED (рекомендуемая формулировка)
- EXAMPLE_GOOD (пример правильного общения)
- EXAMPLE_BAD (пример неправильного общения)

Правила формулируй понятно для сотрудника, кратко. Добавь короткую цитату из документа (sourceQuote).
НЕ придумывай правила, которых нет в документе.

Ответь строго JSON-массивом без markdown:
[{"name":"Название темы","description":"Кратко о теме","rules":[{"type":"REQUIRED","text":"...","sourceQuote":"..."}]}]`;
      return parseJson(await complete(prompt, 8000));
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
      return normalizeQuestions(parseJson(await complete(prompt, 8000)));
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
      return normalizeQuestions(parseJson(await complete(prompt, 8000)));
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
