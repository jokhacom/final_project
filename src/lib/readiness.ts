import { db } from "./db";
import { isChoiceType } from "./ai/provider";
import { getLevelSettings } from "./testSettings";

// В тесты попадают вопросы не из архива и не по устаревшим версиям документов
// (тот же фильтр, что в /api/attempts/start).
export const activeQuestionsFilter = {
  archivedAt: null,
  OR: [{ sourceMaterialId: null }, { sourceMaterial: { isActive: true } }],
};

// Итоговый экзамен считается так же — по его собственным вопросам.
const BASE_LEVELS = ["BEGINNER", "MIDDLE", "PROFESSIONAL", "EXAM"] as const;
// Сколько активных вопросов на каждом уровне. Тест открыт, как только есть хотя бы
// один вопрос: в нём будет min(N, сколько есть) вопросов, где N — настройка
// «вопросов в тесте» этого уровня (по умолчанию 10).
export async function levelReadiness() {
  const settings = await getLevelSettings();
  const rows = await db.question.groupBy({
    by: ["level", "type"],
    where: activeQuestionsFilter,
    _count: { _all: true },
  });

  const levels = BASE_LEVELS.map((level) => {
    const n = settings[level].count;
    const half = Math.floor(n / 2);
    const mine = rows.filter((r) => r.level === level);
    const choice = mine.filter((r) => isChoiceType(r.type)).reduce((s, r) => s + r._count._all, 0);
    const open = mine.filter((r) => !isChoiceType(r.type)).reduce((s, r) => s + r._count._all, 0);
    const total = choice + open;
    return { id: level, choice, open, total, ready: total > 0, full: total >= n, inTest: Math.min(total, n), balanced: choice >= half && open >= half, needed: n };
  });

  return levels;
}
