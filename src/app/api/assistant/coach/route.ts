import { NextResponse } from "next/server";
import { aiProvider } from "@/lib/ai";
import { guardAssistant, recordAssistantUse } from "@/lib/assistant";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const maxDuration = 60;

// «Личный тренер»: берём последние ошибки сотрудника в тестах и правила их тем — ИИ даёт план и 5 упражнений.
// Считается одним ответом из лимита премиума.
export async function POST() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const access = await guardAssistant(user);
  if (access instanceof NextResponse) return access;

  const wrong = await db.answer.findMany({
    where: { isCorrect: false, needsGrading: false, attempt: { userId: user.id, finishedAt: { not: null } } },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      rawAnswer: true,
      question: { select: { text: true, options: true, correctIndex: true, modelAnswer: true, explanation: true, topicId: true, topic: { select: { name: true } } } },
    },
  });
  if (!wrong.length) {
    return NextResponse.json({ error: "Ошибок в тестах пока нет — пройдите тест, и тренер составит план по вашим ошибкам" }, { status: 400 });
  }

  const optionText = (options: unknown, i: number | null) => (Array.isArray(options) && i !== null ? String(options[i] ?? "") : "");
  const mistakes = wrong
    .map(({ rawAnswer, question: q }, n) => {
      const chosen = Array.isArray(q.options) && rawAnswer !== null && /^\d+$/.test(rawAnswer) ? optionText(q.options, Number(rawAnswer)) : rawAnswer;
      const correct = q.correctIndex !== null ? optionText(q.options, q.correctIndex) : q.modelAnswer;
      return [
        `${n + 1}. ${q.topic ? `[${q.topic.name}] ` : ""}${q.text}`,
        `Ответ сотрудника: ${chosen || "—"}`,
        correct ? `Правильно: ${correct}` : "",
        q.explanation ? `Пояснение: ${q.explanation}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n")
    .slice(0, 30000);

  const topicIds = [...new Set(wrong.map((w) => w.question.topicId).filter((id): id is string => !!id))];
  const rules = topicIds.length
    ? (await db.rule.findMany({ where: { topicId: { in: topicIds } }, take: 80, select: { text: true, topic: { select: { name: true } } } }))
        .map((r) => `- [${r.topic.name}] ${r.text}`)
        .join("\n")
    : "";

  try {
    const plan = await aiProvider.coachPlan(mistakes, rules);
    const saved = await recordAssistantUse(user, access, { mode: "coach", input: `План по ${wrong.length} ошибкам в тестах`, result: plan });
    return NextResponse.json({ ...plan, ...saved });
  } catch (e) {
    console.error("coach failed:", e);
    return NextResponse.json({ error: "ИИ не смог составить план — попробуйте ещё раз" }, { status: 502 });
  }
}
