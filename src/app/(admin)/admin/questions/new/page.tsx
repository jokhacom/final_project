"use client";

import { useEffect, useState } from "react";

type Question = { id: string; type: string; level: string; text: string };

// Первая рабочая версия сайта: Суперадминистратор создает вопросы вручную,
// без загрузки документов и без ИИ. Позже /admin/materials (генерация через ИИ)
// будет наполнять ту же базу вопросов — эта страница продолжит работать как есть.
export default function NewQuestionPage() {
  const [type, setType] = useState<"MULTIPLE_CHOICE" | "OPEN">("MULTIPLE_CHOICE");
  const [level, setLevel] = useState("BEGINNER");
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [keywords, setKeywords] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    const res = await fetch(`/api/questions/manual?level=${level}`);
    const data = await res.json();
    setQuestions(data.questions ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  async function save() {
    setError(null);
    setSaved(false);
    const body: any = { type, level, text };
    if (type === "MULTIPLE_CHOICE") {
      body.options = options.filter((o) => o.trim());
      body.correctIndex = correctIndex;
    } else {
      body.expectedKeywords = keywords.split(",").map((k) => k.trim()).filter(Boolean);
    }

    const res = await fetch("/api/questions/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setText("");
    setOptions(["", "", "", ""]);
    setKeywords("");
    setSaved(true);
    load();
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Создание вопросов вручную</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Пока без ИИ — вы сами вводите вопрос, варианты ответа (или ключевые слова для открытого вопроса).
        Нужно минимум 5 вопросов с вариантами и 5 открытых на каждый уровень, чтобы тест мог запуститься.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select value={level} onChange={(e) => setLevel(e.target.value)} style={{ padding: 8 }}>
          <option value="BEGINNER">Beginner</option>
          <option value="MIDDLE">Middle</option>
          <option value="PROFESSIONAL">Professional</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value as any)} style={{ padding: 8 }}>
          <option value="MULTIPLE_CHOICE">С вариантом ответа</option>
          <option value="OPEN">Открытый вопрос</option>
        </select>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Текст вопроса"
        rows={3}
        style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
      />

      {type === "MULTIPLE_CHOICE" ? (
        <div style={{ marginBottom: 12 }}>
          {options.map((opt, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
              <input
                type="radio"
                name="correct"
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                title="Правильный вариант"
              />
              <input
                value={opt}
                onChange={(e) => {
                  const copy = [...options];
                  copy[i] = e.target.value;
                  setOptions(copy);
                }}
                placeholder={`Вариант ${i + 1}`}
                style={{ flex: 1, padding: 6 }}
              />
            </div>
          ))}
        </div>
      ) : (
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Ключевые слова правильного ответа через запятую"
          style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" }}
        />
      )}

      <button
        onClick={save}
        disabled={!text.trim()}
        style={{ padding: "8px 16px", background: "#7C4DFF", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
      >
        Сохранить вопрос
      </button>
      {saved && <span style={{ marginLeft: 12, color: "green" }}>Сохранено ✓</span>}
      {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>
        Вопросы уровня {level} ({questions.length})
      </h2>
      {questions.map((q) => (
        <div key={q.id} style={{ fontSize: 13, borderBottom: "1px solid #eee", padding: "6px 0" }}>
          [{q.type === "MULTIPLE_CHOICE" ? "Вариант" : "Открытый"}] {q.text}
        </div>
      ))}
    </div>
  );
}
