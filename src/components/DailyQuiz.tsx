"use client";

import { useEffect, useState } from "react";

type Q = { id: string; text: string; options: string[] | null; answered?: boolean; correct?: boolean; correctIndex?: number | null; explanation?: string | null };
type Data = { enabled: boolean; date?: string; streak?: number; questions?: Q[] };

// «☀️ Вопросы дня» на странице уровней: 3 вопроса с вариантами раз в день, ответ — сразу с пояснением.
export function DailyQuiz() {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/daily-quiz").then((r) => r.json()).then((d) => {
      setData(d);
      // Открываем на первом вопросе без ответа.
      const first = (d.questions ?? []).findIndex((q: Q) => !q.answered);
      setI(first === -1 ? 0 : first);
    }).catch(() => {});
  }, []);

  if (!data?.enabled || !data.questions?.length) return null;
  const qs = data.questions;
  const answeredCount = qs.filter((q) => q.answered).length;
  const correctCount = qs.filter((q) => q.correct).length;
  const finished = answeredCount === qs.length;
  const q = qs[i];

  async function answer(k: number) {
    if (busy || q.answered) return;
    setBusy(true);
    setChosen(k);
    const res = await fetch("/api/daily-quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: q.id, selectedIndex: k }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return;
    setData((prev) => prev && {
      ...prev,
      streak: d.streak,
      questions: prev.questions!.map((x) => (x.id === q.id ? { ...x, answered: true, correct: d.correct, correctIndex: d.correctIndex, explanation: d.explanation } : x)),
    });
  }

  const next = () => {
    setChosen(null);
    setI(i + 1);
  };

  return (
    <div className="card daily-card" style={{ marginBottom: 16 }}>
      <div className="row between">
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>☀️ Вопросы дня</div>
          <div className="muted small">
            {finished
              ? `Сегодня: ${correctCount} из ${qs.length} верно. Новые вопросы — завтра.`
              : `${qs.length} коротких вопроса на разминку · без конфет · ${answeredCount} из ${qs.length}`}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {!!data.streak && <span className="badge">🔥 {data.streak} {data.streak === 1 ? "день" : [2, 3, 4].includes(data.streak % 10) && ![12, 13, 14].includes(data.streak % 100) ? "дня" : "дней"} подряд</span>}
          {!finished && !open && (
            <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
              {answeredCount ? "Продолжить" : "Начать"}
            </button>
          )}
        </div>
      </div>

      {open && q && (!finished || q.answered) && (
        <div className="stack mt">
          <div className="muted small">Вопрос {i + 1} из {qs.length}</div>
          <div className="question-text" style={{ fontSize: 17 }}>{q.text}</div>
          <div className="stack" style={{ gap: 8 }}>
            {(q.options ?? []).map((opt, k) => (
              <button
                key={k}
                className={`option ${q.answered && k === q.correctIndex ? "correct" : ""} ${q.answered && chosen === k && k !== q.correctIndex ? "wrong" : ""}`}
                disabled={!!q.answered || busy}
                onClick={() => answer(k)}
              >
                <span className="letter">{String.fromCharCode(1040 + k)}</span>
                <span>{opt}</span>
              </button>
            ))}
          </div>
          {q.answered && (
            <>
              <div className={`answer-box ${q.correct ? "ok" : "bad"}`}>
                {q.correct ? "✅ Верно!" : "❌ Неверно — правильный ответ отмечен зелёным."}
                {q.explanation && <div style={{ marginTop: 6 }}>💡 {q.explanation}</div>}
              </div>
              {i + 1 < qs.length ? (
                <button className="btn btn-primary btn-block" onClick={next}>Следующий вопрос →</button>
              ) : (
                <button className="btn btn-ghost btn-block" onClick={() => setOpen(false)}>Готово 🎉</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
