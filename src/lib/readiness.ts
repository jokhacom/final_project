import { db } from "./db";
import { isChoiceType } from "./ai/provider";
import { examSplit, getQuestionCount } from "./testSettings";

// Вопросы по устаревшим версиям документов в тесты не попадают (тот же фильтр, что в /api/attempts/start).
export const activeQuestionsFilter = { OR: [{ sourceMaterialId: null }, { sourceMaterial: { isActive: true } }] };

const BASE_LEVELS = ["BEGINNER", "MIDDLE", "PROFESSIONAL"] as const;
// Сколько активных вопросов на каждом уровне и можно ли уже проходить тест.
// Тесту нужно N вопросов (настройка, по умолчанию 10; лучше половина с вариантами
// и половина открытых, но недостающие добираются другим видом).
export async function levelReadiness() {
  const n = await getQuestionCount();
  const half = Math.floor(n / 2);
  const examNeeds = examSplit(n);
  const rows = await db.question.groupBy({
    by: ["level", "type"],
    where: activeQuestionsFilter,
    _count: { _all: true },
  });

  const levels = BASE_LEVELS.map((level) => {
    const mine = rows.filter((r) => r.level === level);
    const choice = mine.filter((r) => isChoiceType(r.type)).reduce((s, r) => s + r._count._all, 0);
    const open = mine.filter((r) => !isChoiceType(r.type)).reduce((s, r) => s + r._count._all, 0);
    return { id: level, choice, open, total: choice + open, ready: choice + open >= n, balanced: choice >= half && open >= half, needed: n };
  });

  const exam = {
    id: "EXAM" as const,
    choice: levels.reduce((s, l) => s + l.choice, 0),
    open: levels.reduce((s, l) => s + l.open, 0),
    total: levels.reduce((s, l) => s + l.total, 0),
    ready: levels.every((l) => l.total >= examNeeds[l.id]),
    needed: n,
    balanced: levels.every((l) => l.balanced),
  };

  return [...levels, exam];
}
