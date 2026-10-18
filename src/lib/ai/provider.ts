export type Level = "BEGINNER" | "MIDDLE" | "PROFESSIONAL" | "EXAM";
export type RuleType = "REQUIRED" | "FORBIDDEN" | "RECOMMENDED" | "EXAMPLE_GOOD" | "EXAMPLE_BAD";
// Язык создаваемых вопросов и игр: как в документе, русский или узбекский (латиница).
export type ContentLanguage = "auto" | "ru" | "uz";
export const isContentLanguage = (v: unknown): v is ContentLanguage => v === "auto" || v === "ru" || v === "uz";

export type QuestionType = "MULTIPLE_CHOICE" | "OPEN" | "FIND_ERROR" | "FIX_MESSAGE" | "BEST_RESPONSE";

// Типы заданий с вариантами ответа (проверяются сравнением с correctIndex, без ИИ).
// Остальные — свободный ответ, проверяются ИИ или по ключевым словам.
export const CHOICE_TYPES: QuestionType[] = ["MULTIPLE_CHOICE", "BEST_RESPONSE"];
export const isChoiceType = (t: string) => CHOICE_TYPES.includes(t as QuestionType);

export interface GeneratedQuestion {
  type: QuestionType;
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

// Элемент обучающей игры (см. GameItem в schema.prisma).
export interface GeneratedGameItem {
  kind: "TRUE_FALSE" | "FIX_ERROR";
  prompt: string;
  answer?: string;
  isCorrect?: boolean;
  explanation?: string;
}

// Вопрос игры «Грамотность» (см. GameItem с kind LANGUAGE).
export interface GeneratedLanguageItem {
  category: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
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
  // Читает документ целиком и строит базу знаний — темы и правила с цитатой источника.
  extractKnowledge(materialText: string): Promise<ExtractedTopic[]>;

  // Генерация вопросов по конкретной теме и её правилам (Question → Topic).
  generateQuestionsForTopic(topicName: string, rules: ExtractedRule[], level: Level, count: number, language?: ContentLanguage): Promise<GeneratedQuestion[]>;

  // Генерация по всему тексту документа — для материалов без базы знаний.
  // ruleContext — подсказка конкретного правила при перегенерации одного вопроса.
  generateQuestions(materialText: string, level: Level, count: number, ruleContext?: string, language?: ContentLanguage): Promise<GeneratedQuestion[]>;

  // Элементы игр по правилам темы: «Можно или нельзя?» и «Найди и исправь ошибку».
  generateGameItems(topicName: string, rules: ExtractedRule[], count: number, language?: ContentLanguage): Promise<GeneratedGameItem[]>;

  // Вопросы «Грамотности» по русскому или узбекскому языку (не по документу). avoid — уже существующие, чтобы не повторяться.
  generateLanguageItems(language: "ru" | "uz", count: number, avoid: string[]): Promise<GeneratedLanguageItem[]>;

  // Проверка СТРОГО по materialContext (правило + цитата, иначе весь текст материала).
  gradeOpenAnswer(question: string, expectedKeywords: string[], answer: string, materialContext: string | null): Promise<GradeResult>;
}
