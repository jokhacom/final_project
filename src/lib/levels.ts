// Уровни тестов: подписи, цвета и параметры — единые для API и интерфейса.
export type LevelId = "BEGINNER" | "MIDDLE" | "PROFESSIONAL" | "EXAM";

export const LEVELS: { id: LevelId; label: string; icon: string; color: string; description: string }[] = [
  { id: "BEGINNER", label: "Новичок", icon: "🟢", color: "#00E5A0", description: "Базовые правила общения с клиентом" },
  { id: "MIDDLE", label: "Middle", icon: "🟡", color: "#FFC93C", description: "Типичные ситуации и тон ответа" },
  { id: "PROFESSIONAL", label: "Professional", icon: "🔴", color: "#FF6FA5", description: "Сложные и конфликтные кейсы" },
  { id: "EXAM", label: "Итоговый экзамен (KPI)", icon: "🎓", color: "#7C4DFF", description: "Отдельное итоговое задание" },
];

export const levelInfo = (id: string) => LEVELS.find((l) => l.id === id) ?? LEVELS[0];
export const isLevel = (id: unknown): id is LevelId => LEVELS.some((l) => l.id === id);

// Отдельный таймер на каждый открытый вопрос (ответ своими словами): запускается, когда вопрос
// открыт впервые, и идёт, даже если уйти на другой вопрос. Когда вышло — ответ больше не меняется.
// Это значения по умолчанию; суперадмин меняет их на «Обзоре» (Setting "open_question_min_<УРОВЕНЬ>").
export const OPEN_QUESTION_SECONDS: Record<LevelId, number> = { BEGINNER: 180, MIDDLE: 120, PROFESSIONAL: 60, EXAM: 90 };
export const OPEN_GRACE_SEC = 15; // запас на сеть при сохранении ответа в последнюю секунду

// Запас на сетевые задержки и проверку последнего ответа ИИ.
export const TEST_GRACE_SEC = 90;
