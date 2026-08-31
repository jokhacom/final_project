import type { AIProvider, ExtractedTopic, GeneratedQuestion, GradeResult, Level } from "./provider";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

async function callClaude(prompt: string, maxTokens = 2000): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await response.json();
  return data.content.map((b: { text?: string }) => b.text ?? "").join("");
}

function stripJsonFence(text: string): string {
  return text.replace(/```json|```/g, "").trim();
}

export const anthropicProvider: AIProvider = {
  // Раздел 2, 14 запроса: ИИ читает документ и строит базу знаний —
  // темы + правила (обязательные/запрещённые/рекомендуемые/примеры) —
  // ДО того, как из них будут сгенерированы вопросы.
  async extractKnowledge(materialText: string): Promise<ExtractedTopic[]> {
    const prompt = `Ты анализируешь внутренний корпоративный документ (Red Policy / Tone of Voice / стандарты обслуживания).
Документ:
"""
${materialText.slice(0, 12000)}
"""

Разбери документ на темы. Для каждой темы выдели конкретные правила одного из типов:
- REQUIRED (обязательное требование)
- FORBIDDEN (запрещённая формулировка/действие)
- RECOMMENDED (рекомендуемая формулировка)
- EXAMPLE_GOOD (пример правильного общения)
- EXAMPLE_BAD (пример неправильного общения)

Правила формулируй понятно для сотрудника, кратко. Если можешь — добавь короткую цитату из документа (sourceQuote).
НЕ придумывай правила, которых нет в документе.

Ответь строго JSON-массивом без markdown:
[{"name":"Название темы","description":"Кратко о теме","rules":[{"type":"REQUIRED","text":"...","sourceQuote":"..."}]}]`;

    const raw = await callClaude(prompt, 4000);
    return JSON.parse(stripJsonFence(raw));
  },

  // Раздел 21 запроса: генерация вопросов ИМЕННО по одной теме и её правилам —
  // так каждый созданный вопрос прослеживается до конкретного правила (Question → Rule → Topic).
  async generateQuestionsForTopic(topicName: string, rules: import("./provider").ExtractedRule[], level: Level, count: number): Promise<GeneratedQuestion[]> {
    const rulesText = rules
      .map((r, i) => `${i + 1}. [${r.type}] ${r.text}${r.sourceQuote ? ` (источник: "${r.sourceQuote}")` : ""}`)
      .join("\n");

    const prompt = `Ты создаешь вопросы для корпоративного теста сотрудников по теме "${topicName}".
Уровень сложности: ${level}.

Правила этой темы (используй ТОЛЬКО их, не придумывай новых):
${rulesText}

Создай ${count} вопросов. Часть — с вариантами ответа (4 варианта, один правильный, плюс explanation — почему верно и в чём ошибка неверных), часть — открытые (с ключевыми словами ожидаемого ответа).
Каждый вопрос должен проверять одно из перечисленных правил.
Ответь строго в формате JSON-массива без markdown:
[{"type":"MULTIPLE_CHOICE","text":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."},
 {"type":"OPEN","text":"...","expectedKeywords":["...","..."]}]`;

    const raw = await callClaude(prompt);
    return JSON.parse(stripJsonFence(raw));
  },

  async generateQuestions(materialText: string, level: Level, count: number, ruleContext?: string): Promise<GeneratedQuestion[]> {
    const ruleBlock = ruleContext
      ? `Создавай вопрос ИМЕННО по этому конкретному правилу:\n"""\n${ruleContext}\n"""\n\nШире можешь опираться на контекст документа ниже, но вопрос должен проверять именно указанное правило.`
      : `Создавай вопросы на основе всего документа ниже.`;

    const prompt = `Ты создаешь вопросы для корпоративного теста сотрудников на основе внутреннего документа компании.
Уровень сложности: ${level}.
${ruleBlock}

Документ:
"""
${materialText.slice(0, 8000)}
"""
Создай ${count} вопросов, основанных ТОЛЬКО на содержании документа. Часть вопросов — с вариантами ответа (4 варианта, один правильный, плюс краткое explanation — почему правильный ответ верен и в чём ошибка неправильных), часть — открытые (с ключевыми словами ожидаемого ответа для последующей проверки).
Ответь строго в формате JSON-массива без markdown и пояснений:
[{"type":"MULTIPLE_CHOICE","text":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."},
 {"type":"OPEN","text":"...","expectedKeywords":["...","..."]}]`;

    const raw = await callClaude(prompt);
    return JSON.parse(stripJsonFence(raw));
  },

  async gradeOpenAnswer(question: string, expectedKeywords: string[], answer: string, materialContext: string | null): Promise<GradeResult> {
    const contextBlock = materialContext
      ? `Вот фрагмент обучающего материала, на основе которого задан вопрос. Проверяй ответ СТРОГО по этому материалу, а не по общим знаниям:
"""
${materialContext.slice(0, 6000)}
"""`
      : `Материал для этого вопроса не привязан — ориентируйся на ожидаемые темы ниже. Если по вопросу нет отдельного правила, честно укажи это в комментарии.`;

    const prompt = `Оцени ответ сотрудника на открытый вопрос корпоративного теста.
${contextBlock}

Вопрос: "${question}"
Ожидаемые темы (вспомогательно, не обязательно дословно): ${expectedKeywords.join(", ")}
Ответ сотрудника: "${answer}"

Оцени смысловую правильность строго по материалу выше (перефразированный правильный ответ засчитывается), количество орфографических и грамматических ошибок.
В комментарии обязательно объясни ПОЧЕМУ ответ принят или отклонён, сославшись на конкретное правило из материала. Если в материале нет подходящего правила — прямо напиши: "В загруженной документации нет отдельного правила по этому вопросу".
Ответь строго в JSON без markdown:
{"correct": true/false, "spellingErrors": 0, "grammarErrors": 0, "comment": "..."}`;

    const raw = await callClaude(prompt);
    const parsed = JSON.parse(stripJsonFence(raw));
    return {
      correct: !!parsed.correct,
      spellingErrors: Number(parsed.spellingErrors) || 0,
      grammarErrors: Number(parsed.grammarErrors) || 0,
      comment: parsed.comment ?? "",
    };
  },
};
