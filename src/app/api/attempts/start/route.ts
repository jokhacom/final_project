import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isChoiceType } from "@/lib/ai/provider";
import { isLevel } from "@/lib/levels";
import { attemptsLeft, getQuestionCount, getTestMinutes } from "@/lib/testSettings";
import { activeQuestionsFilter } from "@/lib/readiness";
import { attemptQuestionIds, finishAttempt, isRunning, openSecondsLeft, openStartsOf } from "@/lib/attempts";

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

// Любой уровень (Новичок / Middle / Professional / Итоговый экзамен) — N вопросов этого
// уровня (по умолчанию 10: 5 с вариантами + 5 открытых).
// Каждая попытка — новая случайная выборка из активных материалов.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { level } = await req.json();
  if (!isLevel(level)) return NextResponse.json({ error: "Неизвестный уровень" }, { status: 400 });

  // Незавершённый тест этого уровня: если время ещё идёт — продолжаем с того же места
  // (время не останавливалось, ответы сохранены); если вышло — завершаем его, как при таймере.
  const unfinished = await db.testAttempt.findMany({ where: { userId: user.id, level, finishedAt: null }, orderBy: { startedAt: "desc" } });
  for (const a of unfinished) {
    if (isRunning(a)) return NextResponse.json(await attemptPayload(a));
    await finishAttempt(a.id);
  }

  // Лимит попыток: считаются все начатые попытки (и брошенные), чтобы нельзя было
  // бесконечно начинать тест заново и подсматривать вопросы.
  const left = await attemptsLeft(user);
  if (left && left[level] <= 0) {
    return NextResponse.json({ error: "Попытки по этому уровню закончились. Обратитесь к администратору." }, { status: 403 });
  }

  const activeOnly = activeQuestionsFilter;
  const select = { id: true, type: true, level: true };

  const n = await getQuestionCount();
  // Каждый уровень, включая итоговый экзамен, — только свои вопросы.
  // Экзамен — отдельное задание: администратор сам добавляет для него вопросы.
  const pool = await db.question.findMany({ where: { level, ...activeOnly }, select });
  const picked = pick(pool, Math.ceil(n / 2), Math.floor(n / 2));

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

  return NextResponse.json(await attemptPayload(attempt));
}

// Вопросы попытки (без правильных ответов), сохранённые ответы и сколько секунд осталось.
async function attemptPayload(attempt: { id: string; level: string; startedAt: Date; durationSec: number; questionIds: unknown; openStarts: unknown }) {
  const questionIds = attemptQuestionIds(attempt);
  const [full, answers] = await Promise.all([
    db.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, type: true, text: true, options: true, image: true } }),
    db.answer.findMany({ where: { attemptId: attempt.id }, select: { questionId: true, rawAnswer: true } }),
  ]);
  // Правильный ответ, ключевые слова и пояснение в браузер не отдаём — только после завершения.
  const questions = questionIds.map((id) => full.find((q) => q.id === id)).filter((q) => !!q);
  const secondsLeft = Math.max(0, Math.round((attempt.startedAt.getTime() + attempt.durationSec * 1000 - Date.now()) / 1000));
  return {
    attemptId: attempt.id,
    durationSec: attempt.durationSec,
    secondsLeft,
    questions,
    answers: Object.fromEntries(answers.map((a) => [a.questionId, a.rawAnswer ?? ""])),
    // Открытые вопросы, которые уже открывали: сколько секунд на них осталось (может быть ≤ 0).
    openLeft: Object.fromEntries(Object.keys(openStartsOf(attempt)).map((id) => [id, openSecondsLeft(attempt, id)])),
  };
}
