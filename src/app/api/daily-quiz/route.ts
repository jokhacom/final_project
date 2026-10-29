import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { answersOf, dailyQuestions, dailyStreak, isDailyEnabled, todayKey } from "@/lib/dailyQuiz";

// «Вопросы дня» (включаются на «Обзоре»): 3 вопроса с вариантами, раз в день, без конфет.
// GET — вопросы на сегодня (без правильных ответов, кроме уже отвеченных), прогресс и серия дней.
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!(await isDailyEnabled())) return NextResponse.json({ enabled: false });

  const date = todayKey();
  const [questions, result] = await Promise.all([
    dailyQuestions(user.id, date),
    db.dailyQuizResult.findUnique({ where: { userId_date: { userId: user.id, date } } }),
  ]);
  const answers = answersOf(result);
  return NextResponse.json({
    enabled: true,
    date,
    streak: await dailyStreak(user.id, questions.length),
    questions: questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options,
      // Правильный ответ отдаём только для вопросов, на которые уже ответили.
      ...(q.id in answers ? { answered: true, correct: answers[q.id], correctIndex: q.correctIndex, explanation: q.explanation } : {}),
    })),
  });
}

// POST { questionId, selectedIndex } — ответ на вопрос дня (один раз). Возвращает, верно ли, и пояснение.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!(await isDailyEnabled())) return NextResponse.json({ error: "Вопросы дня выключены" }, { status: 403 });

  const { questionId, selectedIndex } = await req.json();
  const date = todayKey();
  const questions = await dailyQuestions(user.id, date);
  const q = questions.find((x) => x.id === questionId);
  if (!q) return NextResponse.json({ error: "Этого вопроса нет в сегодняшних" }, { status: 400 });

  const existing = await db.dailyQuizResult.findUnique({ where: { userId_date: { userId: user.id, date } } });
  const answers = answersOf(existing);
  if (!(questionId in answers)) {
    answers[questionId] = Number(selectedIndex) === q.correctIndex;
    await db.dailyQuizResult.upsert({
      where: { userId_date: { userId: user.id, date } },
      create: { userId: user.id, date, answers },
      update: { answers },
    });
  }
  return NextResponse.json({
    correct: answers[questionId],
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    streak: await dailyStreak(user.id, questions.length),
  });
}
