"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LEVEL_LABEL, QuestionForm, TYPE_LABEL, toDraft } from "@/components/admin/QuestionForm";

type Q = {
  id: string;
  type: string;
  level: string;
  text: string;
  options: string[] | null;
  correctIndex: number | null;
  expectedKeywords: string[] | null;
  explanation: string | null;
  sourceMaterial: { title: string; version: number } | null;
  topic: { name: string } | null;
};

// Банк вопросов: просмотр, правка, удаление и перегенерация ИИ.
export default function QuestionsPage() {
  const [level, setLevel] = useState("");
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/questions/manual${level ? `?level=${level}` : ""}`);
    const data = await res.json();
    setQuestions(data.questions ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  async function act(id: string, method: "DELETE" | "POST") {
    if (method === "DELETE" && !confirm("Удалить вопрос? Ответы сотрудников на него тоже удалятся.")) return;
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/questions/${id}`, { method });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setError(data.error ?? "Ошибка");
    load();
  }

  const counts = (questions ?? []).reduce<Record<string, number>>((acc, q) => {
    acc[q.level] = (acc[q.level] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="row between">
        <h1>Банк вопросов</h1>
        <Link href="/admin/questions/new" className="btn btn-primary">
          + Добавить вручную
        </Link>
      </div>
      <p className="muted small">
        Для теста нужно минимум 10 вопросов на уровень (5 с вариантами + 5 открытых). Сгенерировать вопросы ИИ можно в разделе «Материалы».
      </p>

      <div className="row">
        <select className="select" style={{ maxWidth: 240 }} value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">Все уровни</option>
          {Object.entries(LEVEL_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {!level &&
          Object.entries(LEVEL_LABEL).map(([v, l]) => (
            <span key={v} className="badge">
              {l}: {counts[v] ?? 0}
            </span>
          ))}
      </div>

      {error && <div className="alert alert-error mt">{error}</div>}

      <div className="stack mt">
        {!questions ? (
          <div className="card"><div className="spinner" /></div>
        ) : questions.length === 0 ? (
          <div className="card muted center">Вопросов пока нет</div>
        ) : (
          questions.map((q) =>
            editing === q.id ? (
              <div key={q.id} className="card">
                <QuestionForm initial={toDraft(q)} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />
              </div>
            ) : (
              <div key={q.id} className="card">
                <div className="row" style={{ gap: 6 }}>
                  <span className="badge">{LEVEL_LABEL[q.level] ?? q.level}</span>
                  <span className="badge">{TYPE_LABEL[q.type] ?? q.type}</span>
                  {q.sourceMaterial && (
                    <span className="badge">
                      📄 {q.sourceMaterial.title} v{q.sourceMaterial.version}
                      {q.topic ? ` · ${q.topic.name}` : ""}
                    </span>
                  )}
                </div>
                <p style={{ fontWeight: 700, whiteSpace: "pre-wrap" }}>{q.text}</p>
                {q.options ? (
                  <ol className="small" style={{ margin: 0 }}>
                    {q.options.map((o, i) => (
                      <li key={i} style={{ fontWeight: i === q.correctIndex ? 800 : 400, color: i === q.correctIndex ? "var(--success)" : undefined }}>
                        {o}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="small muted">Ключевые слова: {(q.expectedKeywords ?? []).join(", ")}</div>
                )}
                {q.explanation && <div className="small muted mt">💡 {q.explanation}</div>}
                <div className="row mt">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(q.id)}>
                    ✏️ Изменить
                  </button>
                  {q.sourceMaterial && (
                    <button className="btn btn-ghost btn-sm" disabled={busy === q.id} onClick={() => act(q.id, "POST")}>
                      🔄 Перегенерировать ИИ
                    </button>
                  )}
                  <button className="btn btn-danger btn-sm" disabled={busy === q.id} onClick={() => act(q.id, "DELETE")}>
                    Удалить
                  </button>
                </div>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
