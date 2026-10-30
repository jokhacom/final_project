// Достижения. Набор "правил проверки" (check) живёт в коде, т.к. это логика, а не текст.

export interface AchievementStats {
  history: { candies: number; level: string }[]; // все завершённые попытки сотрудника
  correctAnswers: number; // всего правильных ответов за всё время
}

export interface AchievementDef {
  id: string;
  label: string;
  description: string;
  icon: string;
  check: (s: AchievementStats) => boolean;
  premium?: boolean; // выдаётся за «Помощника ответов» (см. awardAchievement в lib/assistant.ts), не по тестам
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first", label: "Первый тест", description: "Пройти первый тест", icon: "🏆", check: (s) => s.history.length >= 1 },
  { id: "streak10", label: "10 тестов", description: "Пройти 10 тестов", icon: "🔥", check: (s) => s.history.length >= 10 },
  { id: "perfect", label: "Без ошибок", description: "Получить 100 🍬", icon: "✨", check: (s) => s.history.some((r) => r.candies === 100) },
  { id: "hundred_correct", label: "100 правильных ответов", description: "Ответить верно 100 раз", icon: "💯", check: (s) => s.correctAnswers >= 100 },
  { id: "exam", label: "Сдал экзамен", description: "Набрать 85+ 🍬 на итоговом экзамене", icon: "🎓", check: (s) => s.history.some((r) => r.level === "EXAM" && r.candies >= 85) },
  { id: "expert", label: "Эксперт ГЦО", description: "95+ 🍬 на уровне Professional", icon: "👑", check: (s) => s.history.some((r) => r.level === "PROFESSIONAL" && r.candies >= 95) },
  // Премиум-достижения: видны всем (закрытыми), получить можно только с премиумом.
  { id: "premium", label: "Премиум", description: "Получить премиум-доступ", icon: "⭐", premium: true, check: () => false },
  { id: "assistant10", label: "Быстрые ответы", description: "Получить 10 ответов от «Помощника»", icon: "⚡", premium: true, check: () => false },
  { id: "self_check", label: "Самопроверка", description: "Проверить 5 своих ответов", icon: "🔍", premium: true, check: () => false },
  { id: "clean_reply", label: "Чистый ответ", description: "Пройти проверку ответа без единой ошибки", icon: "💎", premium: true, check: () => false },
  { id: "coach", label: "С тренером", description: "Решить все упражнения личного тренера", icon: "🎯", premium: true, check: () => false },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

export function checkNewAchievements(stats: AchievementStats, alreadyEarned: string[]): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !a.premium && !alreadyEarned.includes(a.id) && a.check(stats));
}
