import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isChoiceType } from "@/lib/ai/provider";
import { isLevel, QUESTIONS_PER_TEST, TEST_DURATION_SEC } from "@/lib/levels";

function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

type Q = { id: string; type: string; level: string };

// Берём `choice` вопросов с вариантами и `open` — со свободным ответом.
// Если одного вида не хватает, добираем другим, чтобы тест всё равно состоялся.
function pick(pool: Q[], choice: number, open: number): Q[] {
  const choicePool = sample(pool.filter((q) => isChoiceType(q.type)), Infinity);
  const openPool = sample(pool.filter((q) => !isChoiceType(q.type)), Infinity);
  const a = choicePool.slice(0, choice);
  const b = openPool.slice(0, open);
  const rest = [...choicePool.slice(choice), ...openPool.slice(open)];
  return [...a, ...b, ...rest.slice(0, Math.max(0, choice + open - a.length - b.length))];
}

// Новичок / Middle / Professional — 10 вопросов уровня (5 с вариантами + 5 открытых).
// Итоговый экзамен — 3 Новичок + 3 Middle + 4 Professional, тоже 5 + 5.
// Каждая попытка — новая случайная выборка из активных материалов.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { level } = await req.json();
  if (!isLevel(level)) return NextResponse.json({ error: "Неизвестный уровень" }, { status: 400 });

  // Вопросы по устаревшим версиям документов в новые тесты не попадают.
  const activeOnly = { OR: [{ sourceMaterialId: null }, { sourceMaterial: { isActive: true } }] };
  const select = { id: true, type: true, level: true };

  let picked: Q[];
  if (level === "EXAM") {
    const [beginner, middle, professional] = await Promise.all(
      (["BEGINNER", "MIDDLE", "PROFESSIONAL"] as const).map((l) => db.question.findMany({ where: { level: l, ...activeOnly }, select }))
    );
    picked = [...pick(beginner, 1, 2), ...pick(middle, 2, 1), ...pick(professional, 2, 2)];
  } else {
    const pool = await db.question.findMany({ where: { level, ...activeOnly }, select });
    picked = pick(pool, 5, 5);
  }

  if (picked.length < QUESTIONS_PER_TEST) {
    return NextResponse.json(
      { error: "Для этого уровня пока недостаточно вопросов. Попросите администратора добавить материалы и вопросы." },
      { status: 422 }
    );
  }

  // Сначала вопросы с вариантами, затем открытые — как в макете теста.
  const ordered = [...picked.filter((q) => isChoiceType(q.type)), ...picked.filter((q) => !isChoiceType(q.type))];
  const questionIds = ordered.map((q) => q.id);

  const attempt = await db.testAttempt.create({ data: { userId: user.id, level, candies: 0, questionIds } });

  const full = await db.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, type: true, text: true, options: true },
  });
  // Правильный ответ, ключевые слова и пояснение в браузер не отдаём — только после завершения.
  const questions = questionIds.map((id) => full.find((q) => q.id === id)!);

  return NextResponse.json({
    attemptId: attempt.id,
    startedAt: attempt.startedAt,
    durationSec: TEST_DURATION_SEC,
    questions,
  });
}
