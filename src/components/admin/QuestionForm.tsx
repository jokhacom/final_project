"use client";

import { useState } from "react";
import { ImagePicker } from "./ImagePicker";

export type QuestionDraft = {
  id?: string;
  type: string;
  level: string;
  text: string;
  options: string[];
  correctIndex: number;
  expectedKeywords: string;
  modelAnswer: string;
  explanation: string;
  image: string;
};

export const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: "Выбор ответа",
  BEST_RESPONSE: "Лучший ответ клиенту",
  OPEN: "Открытый вопрос",
  FIND_ERROR: "Найди ошибку",
  FIX_MESSAGE: "Исправь сообщение",
};
export const LEVEL_LABEL: Record<string, string> = { BEGINNER: "Новичок", MIDDLE: "Middle", PROFESSIONAL: "Professional" };
const CHOICE = ["MULTIPLE_CHOICE", "BEST_RESPONSE"];

export const emptyDraft = (level = "BEGINNER"): QuestionDraft => ({
  type: "MULTIPLE_CHOICE",
  level,
  text: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  expectedKeywords: "",
  modelAnswer: "",
  explanation: "",
  image: "",
});

export function toDraft(q: any): QuestionDraft {
  const options = Array.isArray(q.options) ? [...q.options] : [];
  while (options.length < 4) options.push("");
  return {
    id: q.id,
    type: q.type,
    level: q.level,
    text: q.text,
    options,
    correctIndex: q.correctIndex ?? 0,
    expectedKeywords: Array.isArray(q.expectedKeywords) ? q.expectedKeywords.join(", ") : "",
    modelAnswer: q.modelAnswer ?? "",
    explanation: q.explanation ?? "",
    image: q.image ?? "",
  };
}

// Форма создания/правки вопроса. Для вариантов ответа — 4 поля и отметка правильного,
// для свободного ответа — ключевые слова (запасная проверка без ИИ) и пояснение.
export function QuestionForm({ initial, onSaved, onCancel }: { initial: QuestionDraft; onSaved: () => void; onCancel?: () => void }) {
  const [q, setQ] = useState<QuestionDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isChoice = CHOICE.includes(q.type);

  async function save() {
    setSaving(true);
    setError(null);
    const body: any = { type: q.type, level: q.level, text: q.text, explanation: q.explanation, image: q.image };
    if (isChoice) {
      const filled = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
      body.options = filled.map((x) => x.o);
      body.correctIndex = filled.findIndex((x) => x.i === q.correctIndex);
    } else {
      body.expectedKeywords = q.expectedKeywords.split(",").map((k) => k.trim()).filter(Boolean);
      body.modelAnswer = q.modelAnswer;
    }
    const res = await fetch(q.id ? `/api/questions/${q.id}` : "/api/questions/manual", {
      method: q.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Не удалось сохранить");
      return;
    }
    if (!q.id) setQ(emptyDraft(q.level));
    onSaved();
  }

  return (
    <div className="stack">
      <div className="grid grid-2">
        <label className="field">
          Тип задания
          <select className="select" value={q.type} onChange={(e) => setQ({ ...q, type: e.target.value })}>
            {Object.entries(TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Уровень
          <select className="select" value={q.level} onChange={(e) => setQ({ ...q, level: e.target.value })}>
            {Object.entries(LEVEL_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        {q.type === "FIND_ERROR" || q.type === "FIX_MESSAGE" ? "Задание и сообщение сотрудника" : "Текст вопроса"}
        <textarea className="textarea" rows={4} value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} />
      </label>

      {isChoice ? (
        <div className="stack" style={{ gap: 8 }}>
          <div className="small muted">Варианты ответа — отметьте правильный</div>
          {q.options.map((opt, i) => (
            <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
              <input type="radio" checked={q.correctIndex === i} onChange={() => setQ({ ...q, correctIndex: i })} />
              <input
                className="input"
                value={opt}
                placeholder={`Вариант ${i + 1}`}
                onChange={(e) => setQ({ ...q, options: q.options.map((o, j) => (j === i ? e.target.value : o)) })}
              />
            </div>
          ))}
        </div>
      ) : (
        <>
          <label className="field">
            Эталонный ответ — как ответили бы вы
            <textarea
              className="textarea"
              rows={4}
              style={{ minHeight: 100 }}
              value={q.modelAnswer}
              onChange={(e) => setQ({ ...q, modelAnswer: e.target.value })}
              placeholder="Например: Здравствуйте! Понимаю ваш вопрос. Сейчас проверю начисления и подробно объясню..."
            />
            <span className="muted small" style={{ fontWeight: 400 }}>
              Сотрудник увидит его в разборе после теста. ИИ проверяет ответ по смыслу с опорой на эталон.
            </span>
          </label>
          <label className="field">
            Ключевые слова (через запятую, необязательно)
            <input className="input" value={q.expectedKeywords} onChange={(e) => setQ({ ...q, expectedKeywords: e.target.value })} />
            <span className="muted small" style={{ fontWeight: 400 }}>
              Для проверки без ИИ: ответ засчитывается, если в нём есть хотя бы одно слово. Если не заполнять — ответ сверяется с эталонным.
            </span>
          </label>
        </>
      )}

      <ImagePicker value={q.image} onChange={(image) => setQ({ ...q, image })} />

      <label className="field">
        Пояснение для разбора (какой ответ верный и почему)
        <textarea className="textarea" rows={3} style={{ minHeight: 80 }} value={q.explanation} onChange={(e) => setQ({ ...q, explanation: e.target.value })} />
      </label>

      {error && <div className="alert alert-error">{error}</div>}
      <div className="row">
        <button className="btn btn-primary" onClick={save} disabled={saving || !q.text.trim()}>
          {saving ? "Сохраняем..." : q.id ? "Сохранить изменения" : "Добавить вопрос"}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" onClick={onCancel}>
            Отмена
          </button>
        )}
      </div>
    </div>
  );
}
