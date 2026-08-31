// Раздел 11-12 ТЗ: система «конфет».
// Максимум 100. -5 за неверный ответ, -1 за орфографическую ошибку, -1 за грамматическую.

export interface ScoredAnswer {
  isCorrect: boolean;
  spellingErrors: number;
  grammarErrors: number;
}

export function calculateCandies(answers: ScoredAnswer[]): number {
  let candies = 100;
  for (const a of answers) {
    if (!a.isCorrect) candies -= 5;
    candies -= a.spellingErrors;
    candies -= a.grammarErrors;
  }
  return Math.max(0, candies);
}

export function resultLevel(candies: number): { label: string; comment: string } {
  if (candies >= 95) return { label: "Эксперт", comment: "Превосходный результат, вы отлично знаете материал." };
  if (candies >= 85) return { label: "Отлично", comment: "Очень хороший результат, есть мелкие недочёты." };
  if (candies >= 70) return { label: "Хорошо", comment: "Хороший результат, стоит повторить пару тем." };
  if (candies >= 50) return { label: "Нужно повторить материал", comment: "Рекомендуем повторить материал перед следующей попыткой." };
  return { label: "Требуется обучение", comment: "Результат ниже порога — нужно пройти обучение заново." };
}
