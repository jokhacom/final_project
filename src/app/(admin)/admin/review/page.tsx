"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  rawAnswer: string;
  isCorrect: boolean;
  spellingErrors: number;
  grammarErrors: number;
  aiComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  question: { text: string; modelAnswer: string | null; expectedKeywords: string[] | null; level: string; image: string | null };
  attempt: { id: string; candies: number; user: { name: string; username: string } };
};

// Ручная проверка открытых ответов: автоматическая оценка (по словам или ИИ)
// подставлена по умолчанию, администратор подтверждает или исправляет её.
export default function ReviewPage() {
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [items, setItems] = useState<Item[] | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  async function load() {
    const res = await fetch(`/api/admin/review?status=${status}`);
    const data = await res.json();
    setItems(data.answers ?? []);
    setPendingCount(data.pendingCount ?? 0);
  }

  useEffect(() => {
    setItems(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="stack">
      <div>
        <h1>Проверка ответов</h1>
        <p className="muted small">
          Открытые ответы сотрудников. Оценка уже поставлена автоматически — подтвердите её или исправьте. «Конфеты», рейтинг и разбор у
          сотрудника обновятся сразу.
        </p>
      </div>

      <div className="tabs" style={{ maxWidth: 420 }}>
        <button className={status === "pending" ? "active" : ""} onClick={() => setStatus("pending")}>
          Не проверены ({pendingCount})
        </button>
        <button className={status === "all" ? "active" : ""} onClick={() => setStatus("all")}>
          Все
        </button>
      </div>

      {!items ? (
        <div className="card"><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="card muted center">{status === "pending" ? "Все ответы проверены 🎉" : "Ответов пока нет"}</div>
      ) : (
        items.map((item) => <ReviewCard key={item.id} item={item} onSaved={load} />)
      )}
    </div>
  );
}

function ReviewCard({ item, onSaved }: { item: Item; onSaved: () => void }) {
  const [isCorrect, setIsCorrect] = useState(item.isCorrect);
  const [spelling, setSpelling] = useState(item.spellingErrors);
  const [grammar, setGrammar] = useState(item.grammarErrors);
  const [comment, setComment] = useState(item.aiComment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/review/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCorrect, spellingErrors: spelling, grammarErrors: grammar, comment }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Не удалось сохранить");
    onSaved();
  }

  const keywords = item.question.expectedKeywords ?? [];

  return (
    <div className={`card review-item ${isCorrect ? "ok" : "bad"}`}>
      <div className="row between small">
        <span>
          <strong>{item.attempt.user.name}</strong> <span className="muted">@{item.attempt.user.username}</span>
        </span>
        <span className="muted">
          {new Date(item.createdAt).toLocaleString("ru-RU")}
          {item.reviewedAt && " · ✔ проверено"}
        </span>
      </div>
      <p style={{ fontWeight: 800, whiteSpace: "pre-wrap", margin: "8px 0" }}>{item.question.text}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {item.question.image && <img src={item.question.image} alt="Скриншот" className="question-image" style={{ maxHeight: 200, marginBottom: 8 }} />}

      <div className="small muted">Ответ сотрудника</div>
      <div className="answer-box info" style={{ marginBottom: 8 }}>{item.rawAnswer || "— пусто —"}</div>

      {(item.question.modelAnswer || keywords.length > 0) && (
        <>
          <div className="small muted">{item.question.modelAnswer ? "Эталонный ответ" : "Ключевые слова"}</div>
          <div className="answer-box ok" style={{ marginBottom: 8 }}>{item.question.modelAnswer || keywords.join(", ")}</div>
        </>
      )}

      <div className="row" style={{ marginTop: 4 }}>
        <button className={`btn btn-sm ${isCorrect ? "btn-primary" : "btn-ghost"}`} onClick={() => setIsCorrect(true)}>
          ✅ Верно
        </button>
        <button className={`btn btn-sm ${!isCorrect ? "btn-danger" : "btn-ghost"}`} onClick={() => setIsCorrect(false)}>
          ❌ Неверно (−5 🍬)
        </button>
        <label className="row small" style={{ gap: 6 }}>
          Орфогр.
          <input className="input" style={{ width: 64, padding: "6px 8px" }} type="number" min={0} max={20} value={spelling} onChange={(e) => setSpelling(Number(e.target.value))} />
        </label>
        <label className="row small" style={{ gap: 6 }}>
          Грамм.
          <input className="input" style={{ width: 64, padding: "6px 8px" }} type="number" min={0} max={20} value={grammar} onChange={(e) => setGrammar(Number(e.target.value))} />
        </label>
      </div>
      <textarea
        className="textarea"
        style={{ minHeight: 70, marginTop: 8 }}
        placeholder="Комментарий для сотрудника (увидит в разборе)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && <div className="alert alert-error mt">{error}</div>}
      <div className="row mt">
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? "Сохраняем..." : item.reviewedAt ? "Сохранить изменения" : "Подтвердить оценку"}
        </button>
        <span className="muted small">Сейчас за тест: {item.attempt.candies} 🍬</span>
      </div>
    </div>
  );
}
