// Система «конфет». Максимум 100, −1 за орфографическую и −1 за грамматическую ошибку.
// Штраф за неверный ответ зависит от числа вопросов в тесте: 50 / N
// (10 вопросов — −5, как в ТЗ; 20 — −2,5; 40 — −1,25): одинаковая доля ошибок
// даёт одинаковый результат при любом размере теста (половина неверных — 75 🍬).

export interface ScoredAnswer {
  isCorrect: boolean;
  spellingErrors: number;
  grammarErrors: number;
}

export const wrongPenalty = (total: number) => 50 / Math.max(1, total);

// Для подписей: «−5», «−2,5», «−1,3».
export const formatPenalty = (total: number) => String(Math.round(wrongPenalty(total) * 10) / 10).replace(".", ",");

export function calculateCandies(answers: ScoredAnswer[]): number {
  const penalty = wrongPenalty(answers.length);
  let candies = 100;
  for (const a of answers) {
    if (!a.isCorrect) candies -= penalty;
    candies -= a.spellingErrors;
    candies -= a.grammarErrors;
  }
  return Math.max(0, Math.round(candies));
}

export function resultLevel(candies: number): { label: string; comment: string } {
  if (candies >= 95) return { label: "Эксперт", comment: "Превосходный результат, вы отлично знаете материал." };
  if (candies >= 85) return { label: "Отлично", comment: "Очень хороший результат, есть мелкие недочёты." };
  if (candies >= 70) return { label: "Хорошо", comment: "Хороший результат, стоит повторить пару тем." };
  if (candies >= 50) return { label: "Нужно повторить материал", comment: "Рекомендуем повторить материал перед следующей попыткой." };
  return { label: "Требуется обучение", comment: "Результат ниже порога — нужно пройти обучение заново." };
}
