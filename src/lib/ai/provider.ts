export type Level = "BEGINNER" | "MIDDLE" | "PROFESSIONAL";
export type RuleType = "REQUIRED" | "FORBIDDEN" | "RECOMMENDED" | "EXAMPLE_GOOD" | "EXAMPLE_BAD";

export interface GeneratedQuestion {
  type: "MULTIPLE_CHOICE" | "OPEN";
  text: string;
  options?: string[];
  correctIndex?: number;
  expectedKeywords?: string[];
  explanation?: string; // объяснение правильного ответа и типичных ошибок
}

export interface GradeResult {
  correct: boolean;
  spellingErrors: number;
  grammarErrors: number;
  comment: string; // должен объяснять, ПОЧЕМУ ответ принят/отклонён, ссылаясь на правило
}

export interface ExtractedRule {
  type: RuleType;
  text: string;        // само правило, понятным языком
  sourceQuote?: string; // короткая цитата из документа
}

export interface ExtractedTopic {
  name: string;
  description?: string;
  rules: ExtractedRule[];
}

// Единственный контракт, от которого зависит остальное приложение.
// Бизнес-логика (начисление конфет, сохранение в БД, админ-панель)
// работает с этим интерфейсом и не знает, какой именно AI за ним стоит.
export interface AIProvider {
  // Раздел 2, 14, 21 запроса: читает документ целиком и строит базу знаний —
  // список тем, и внутри каждой темы — конкретные правила с цитатой источника.
  // Это тот же текст, который затем используется для генерации вопросов и проверки.
  extractKnowledge(materialText: string): Promise<ExtractedTopic[]>;

  // Генерация вопросов по конкретной теме и её правилам — а не по всему документу
  // сразу, чтобы каждый вопрос был прослеживаем до конкретной темы (Question → Topic).
  generateQuestionsForTopic(topicName: string, rules: ExtractedRule[], level: Level, count: number): Promise<GeneratedQuestion[]>;

  // Устаревший путь (по всему тексту документа сразу) — сохранён для обратной
  // совместимости с материалами, для которых ещё не строилась база знаний.
  // ruleContext — необязательная подсказка конкретного правила при перегенерации
  // одного вопроса (см. /api/questions/[id]).
  generateQuestions(materialText: string, level: Level, count: number, ruleContext?: string): Promise<GeneratedQuestion[]>;

  // materialContext — самый точный доступный контекст для проверки: конкретное
  // правило + цитата, если вопрос связан с Rule, иначе — весь текст материала.
  // Проверка выполняется СТРОГО на основе этого текста, а не общих знаний модели.
  gradeOpenAnswer(question: string, expectedKeywords: string[], answer: string, materialContext: string | null): Promise<GradeResult>;
}
