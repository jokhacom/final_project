"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { levelInfo } from "@/lib/levels";
import type { AttemptResult, ReviewItem } from "@/lib/types";

export default function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [data, setData] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<{ id: string; label: string; icon: string }[]>([]);

  useEffect(() => {
    fetch(`/api/attempts/${attemptId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Не удалось загрузить результат");
        setData(d);
      })
      .catch((e) => setError(e.message));
    try {
      const raw = sessionStorage.getItem(`achievements:${attemptId}`);
      if (raw) setAchievements(JSON.parse(raw));
    } catch {}
  }, [attemptId]);

  if (error) {
    return (
      <main className="container narrow">
        <div className="alert alert-error">{error}</div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="container narrow">
        <div className="card center" style={{ padding: 40 }}>
          <div className="spinner" />
        </div>
      </main>
    );
  }

  const info = levelInfo(data.level);

  return (
    <main className="container narrow">
      <div className="card center stack">
        <span className="badge" style={{ color: info.color, alignSelf: "center" }}>
          {info.icon} {info.label}
        </span>
        <div className="score">
          <span className="score-num">{data.candies}</span>
          <span>🍬</span>
        </div>
        <h1 style={{ margin: 0 }}>{data.resultLabel}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {data.resultComment}
        </p>
        <p className="small muted" style={{ margin: 0 }}>
          Правильных ответов: {data.correctCount} из {data.total}
        </p>

        {achievements.length > 0 && (
          <div className="stack">
            <h3 style={{ marginTop: 8 }}>Новые достижения!</h3>
            <div className="row" style={{ justifyContent: "center" }}>
              {achievements.map((a) => (
                <span key={a.id} className="badge" style={{ fontSize: 15, padding: "8px 14px" }}>
                  {a.icon} {a.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="row" style={{ justifyContent: "center" }}>
          {data.certificateEligible && (
            <Link href={`/certificate/${data.attemptId}`} className="btn btn-primary">
              🎓 Получить сертификат
            </Link>
          )}
          <Link href={`/test/${data.level}`} className="btn btn-ghost">
            Пройти ещё раз
          </Link>
          <Link href="/levels" className="btn btn-ghost">
            К уровням
          </Link>
        </div>
      </div>

      <h2 className="mt-lg">Разбор ответов</h2>
      <div className="stack">
        {data.review.map((r) => (
          <ReviewCard key={r.questionId} item={r} />
        ))}
      </div>
    </main>
  );
}

function ReviewCard({ item: r }: { item: ReviewItem }) {
  const errors = r.spellingErrors + r.grammarErrors;
  return (
    <div className={`card review-item ${r.isCorrect ? "ok" : "bad"}`}>
      <div className="row between">
        <span className="muted small">Вопрос {r.n}</span>
        <span style={{ fontWeight: 900, color: r.isCorrect ? "var(--success)" : "var(--danger)" }}>
          {r.isCorrect ? "✅ Верно" : "❌ Неверно · −5 🍬"}
          {r.reviewed && <span className="muted small" style={{ fontWeight: 600 }}> · проверено</span>}
        </span>
      </div>
      <p style={{ fontWeight: 800, whiteSpace: "pre-wrap", margin: "8px 0 12px" }}>{r.text}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {r.image && <img src={r.image} alt="Скриншот к вопросу" className="question-image" style={{ marginBottom: 12 }} />}

      {r.options ? (
        <div className="stack" style={{ gap: 6 }}>
          {r.options.map((opt, i) => {
            const isRight = i === r.correctIndex;
            const isPicked = i === r.selectedIndex;
            const cls = isRight ? "ok" : isPicked ? "bad" : "info";
            return (
              <div key={i} className={`answer-box ${cls}`}>
                {isRight ? "✅ " : isPicked ? "❌ " : ""}
                {opt}
                {isPicked && <span className="muted small"> — ваш ответ</span>}
              </div>
            );
          })}
          {r.unanswered && <div className="muted small">Вы не ответили на этот вопрос.</div>}
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          <div>
            <div className="small muted">Ваш ответ</div>
            <div className={`answer-box ${r.isCorrect ? "ok" : "bad"}`}>
              {r.isCorrect ? "✅ " : "❌ "}
              {r.userAnswer || "— нет ответа —"}
            </div>
          </div>
          {r.correctAnswer && (
            <div>
              <div className="small muted">{r.correctAnswerIsModel ? "Эталонный ответ" : "Ключевые моменты правильного ответа"}</div>
              <div className="answer-box ok">✅ {r.correctAnswer}</div>
            </div>
          )}
          {r.comment && (
            <div>
              <div className="small muted">{r.reviewed ? "Комментарий проверяющего" : "Комментарий проверки"}</div>
              <div className="answer-box info">{r.comment}</div>
            </div>
          )}
          {errors > 0 && (
            <div className="small" style={{ color: "var(--warning)" }}>
              ✏️ Орфографических ошибок: {r.spellingErrors}, грамматических: {r.grammarErrors} (−{errors} 🍬)
            </div>
          )}
        </div>
      )}

      {(r.explanation || r.rule) && (
        <div className="answer-box info" style={{ marginTop: 10 }}>
          💡 {r.explanation ?? `Правило: ${r.rule}`}
        </div>
      )}
    </div>
  );
}
