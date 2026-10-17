import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isChoiceType } from "@/lib/ai/provider";
import { isLevel } from "@/lib/levels";
import { examSplit, getQuestionCount, getTestMinutes } from "@/lib/testSettings";
import { activeQuestionsFilter } from "@/lib/readiness";

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

// Новичок / Middle / Professional — N вопросов уровня (по умолчанию 10: 5 с вариантами + 5 открытых).
// Итоговый экзамен — 30% Новичок + 30% Middle + 40% Professional (для 10 вопросов: 3 + 3 + 4).
// Каждая попытка — новая случайная выборка из активных материалов.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { level } = await req.json();
  if (!isLevel(level)) return NextResponse.json({ error: "Неизвестный уровень" }, { status: 400 });

  const activeOnly = activeQuestionsFilter;
  const select = { id: true, type: true, level: true };

  const n = await getQuestionCount();
  let picked: Q[];
  if (level === "EXAM") {
    const [beginner, middle, professional] = await Promise.all(
      (["BEGINNER", "MIDDLE", "PROFESSIONAL"] as const).map((l) => db.question.findMany({ where: { level: l, ...activeOnly }, select }))
    );
    // По каждому уровню примерно поровну вопросов с вариантами и открытых; у Новичка больше открытых, у Middle — с вариантами.
    const split = examSplit(n);
    picked = [
      ...pick(beginner, Math.floor(split.BEGINNER / 2), Math.ceil(split.BEGINNER / 2)),
      ...pick(middle, Math.ceil(split.MIDDLE / 2), Math.floor(split.MIDDLE / 2)),
      ...pick(professional, Math.ceil(split.PROFESSIONAL / 2), Math.floor(split.PROFESSIONAL / 2)),
    ];
    // Если на каком-то уровне вопросов мало — добираем вопросами других уровней.
    const taken = new Set(picked.map((q) => q.id));
    const rest = sample([...beginner, ...middle, ...professional].filter((q) => !taken.has(q.id)), Infinity);
    picked = [...picked, ...rest.slice(0, Math.max(0, n - picked.length))];
  } else {
    const pool = await db.question.findMany({ where: { level, ...activeOnly }, select });
    picked = pick(pool, Math.ceil(n / 2), Math.floor(n / 2));
  }

  // В тесте — сколько есть, но не больше настройки «вопросов в тесте».
  if (picked.length === 0) {
    return NextResponse.json(
      { error: "Для этого уровня пока нет вопросов. Попросите администратора добавить материалы и вопросы." },
      { status: 422 }
    );
  }

  // Сначала вопросы с вариантами, затем открытые — как в макете теста.
  const ordered = [...picked.filter((q) => isChoiceType(q.type)), ...picked.filter((q) => !isChoiceType(q.type))];
  const questionIds = ordered.map((q) => q.id);

  const durationSec = (await getTestMinutes()) * 60;
  const attempt = await db.testAttempt.create({ data: { userId: user.id, level, candies: 0, questionIds, durationSec } });

  const full = await db.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, type: true, text: true, options: true, image: true },
  });
  // Правильный ответ, ключевые слова и пояснение в браузер не отдаём — только после завершения.
  const questions = questionIds.map((id) => full.find((q) => q.id === id)!);

  return NextResponse.json({
    attemptId: attempt.id,
    startedAt: attempt.startedAt,
    durationSec,
    questions,
  });
}
