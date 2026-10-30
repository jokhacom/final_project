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
  modelAnswer?: string; // образец правильного ответа для открытых заданий
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

// Готовый ответ клиенту от «Помощника ответов». found — нашлось ли в файлах, на что опереться.
export interface GeneratedReply {
  found: boolean;
  ru: string;
  uz: string;
  note?: string; // коротко для сотрудника: на какой шаблон опирался или чего не хватает
}

// Тон ответа «Помощника»: как в шаблонах или по выбору сотрудника.
export type ReplyTone = "default" | "official" | "friendly" | "short" | "angry";
export const REPLY_TONES: ReplyTone[] = ["default", "official", "friendly", "short", "angry"];
export const isReplyTone = (v: unknown): v is ReplyTone => REPLY_TONES.includes(v as ReplyTone);

// Картинка для ИИ (скриншот переписки): base64 без префикса data:.
export interface AIImage {
  mimeType: string;
  data: string;
}

// «Проверь мой ответ»: что не так в ответе сотрудника и исправленный вариант.
export interface CheckedReply {
  verdict: "good" | "fix";
  issues: { quote: string; problem: string; rule: string }[];
  fixed: string; // исправленный ответ на том же языке, что черновик
  comment: string; // коротко для сотрудника, по-русски
}

// «Личный тренер»: план по слабым местам и упражнения.
export interface CoachPlan {
  summary: string;
  focus: { rule: string; why: string; tip: string }[];
  exercises: { question: string; options: string[]; correctIndex: number; explanation: string }[];
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
  // mix — точно сколько с вариантами и сколько открытых (иначе count на усмотрение ИИ).
  generateQuestionsForTopic(
    topicName: string,
    rules: ExtractedRule[],
    level: Level,
    count: number,
    language?: ContentLanguage,
    mix?: { choice: number; open: number }
  ): Promise<GeneratedQuestion[]>;

  // Генерация по всему тексту документа — для материалов без базы знаний.
  // ruleContext — подсказка конкретного правила при перегенерации одного вопроса.
  generateQuestions(
    materialText: string,
    level: Level,
    count: number,
    ruleContext?: string,
    language?: ContentLanguage,
    mix?: { choice: number; open: number }
  ): Promise<GeneratedQuestion[]>;

  // Элементы игр по правилам темы: «Можно или нельзя?» и «Найди и исправь ошибку».
  generateGameItems(topicName: string, rules: ExtractedRule[], count: number, language?: ContentLanguage): Promise<GeneratedGameItem[]>;

  // Вопросы «Грамотности» по русскому или узбекскому языку (не по документу). avoid — уже существующие, чтобы не повторяться.
  generateLanguageItems(language: "ru" | "uz", count: number, avoid: string[]): Promise<GeneratedLanguageItem[]>;

  // Готовый ответ на вопрос клиента строго по файлам «Помощника ответов» — на русском и узбекском.
  // tone — тон ответа, image — скриншот переписки (тогда clientMessage может быть пустым).
  generateReply(knowledge: string, clientMessage: string, opts?: { tone?: ReplyTone; image?: AIImage }): Promise<GeneratedReply>;

  // «Проверь мой ответ»: черновик сотрудника по тем же файлам — ошибки и исправленный вариант.
  checkReply(knowledge: string, clientMessage: string, draft: string): Promise<CheckedReply>;

  // «Личный тренер»: по ошибкам сотрудника в тестах — что повторить и упражнения с вариантами.
  coachPlan(mistakes: string, rules: string): Promise<CoachPlan>;

  // Проверка СТРОГО по materialContext (правило + цитата, иначе весь текст материала).
  gradeOpenAnswer(question: string, expectedKeywords: string[], answer: string, materialContext: string | null): Promise<GradeResult>;
}
