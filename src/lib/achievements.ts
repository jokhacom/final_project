// Раздел 13 ТЗ: достижения. Список редактируется здесь — админ-панель в будущем
// сможет читать/писать этот же список из таблицы Setting без изменения кода,
// но набор "правил проверки" (check) всё равно живёт в коде, т.к. это логика,
// а не текст.

export interface AchievementDef {
  id: string;
  label: string;
  icon: string;
  check: (history: { candies: number; level: string }[]) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first", label: "Первый тест", icon: "🏆", check: (h) => h.length >= 1 },
  { id: "streak10", label: "10 тестов подряд", icon: "🔥", check: (h) => h.length >= 10 },
  { id: "perfect", label: "Без ошибок", icon: "✨", check: (h) => h.some((r) => r.candies === 100) },
  { id: "hundred_correct", label: "100 правильных ответов", icon: "💯", check: (h) => h.filter((r) => r.candies >= 90).length >= 10 },
  { id: "expert", label: "Эксперт ГЦО", icon: "👑", check: (h) => h.some((r) => r.level === "PROFESSIONAL" && r.candies >= 95) },
];

export function checkNewAchievements(history: { candies: number; level: string }[], alreadyEarned: string[]): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !alreadyEarned.includes(a.id) && a.check(history));
}
