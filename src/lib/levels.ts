// Уровни тестов: подписи, цвета и параметры — единые для API и интерфейса.
export type LevelId = "BEGINNER" | "MIDDLE" | "PROFESSIONAL" | "EXAM";

export const LEVELS: { id: LevelId; label: string; icon: string; color: string; description: string }[] = [
  { id: "BEGINNER", label: "Новичок", icon: "🟢", color: "#00E5A0", description: "Базовые правила общения с клиентом" },
  { id: "MIDDLE", label: "Middle", icon: "🟡", color: "#FFC93C", description: "Типичные ситуации и тон ответа" },
  { id: "PROFESSIONAL", label: "Professional", icon: "🔴", color: "#FF6FA5", description: "Сложные и конфликтные кейсы" },
  { id: "EXAM", label: "Итоговый экзамен (KPI)", icon: "🎓", color: "#7C4DFF", description: "Вопросы всех уровней" },
];

export const levelInfo = (id: string) => LEVELS.find((l) => l.id === id) ?? LEVELS[0];
export const isLevel = (id: unknown): id is LevelId => LEVELS.some((l) => l.id === id);

export const QUESTIONS_PER_TEST = 10;
export const TEST_DURATION_SEC = 15 * 60;
// Запас на сетевые задержки и проверку последнего ответа ИИ.
export const TEST_GRACE_SEC = 90;
