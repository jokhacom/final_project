"use client";

import { useState } from "react";

// Раздел 19: плавающая кнопка "💬 Обратная связь" на каждой странице.
// Импортировать этот компонент в корневой layout.tsx, чтобы он был везде.
export default function FeedbackButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("предложение");
  const [description, setDescription] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, type, description }),
    });
    setSent(true);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          borderRadius: 999,
          padding: "12px 18px",
          background: "#7C4DFF",
          color: "white",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}
      >
        💬 Обратная связь
      </button>

      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, padding: 24, width: 320 }}>
            {sent ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32 }}>🎉</div>
                <p>Спасибо! Ваше сообщение успешно отправлено администратору. Спасибо, что помогаете сделать платформу лучше ❤️</p>
                <button onClick={() => { setOpen(false); setSent(false); setDescription(""); }} style={{ marginTop: 8 }}>
                  Закрыть
                </button>
              </div>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>Обратная связь</h3>
                <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%", marginBottom: 8, padding: 6 }}>
                  <option>ошибка</option>
                  <option>предложение</option>
                  <option>вопрос</option>
                  <option>другое</option>
                </select>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Опишите обращение"
                  rows={4}
                  style={{ width: "100%", padding: 8, boxSizing: "border-box", marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={submit} style={{ flex: 1, padding: 8, background: "#7C4DFF", color: "white", border: "none", borderRadius: 8 }}>
                    Отправить
                  </button>
                  <button onClick={() => setOpen(false)} style={{ flex: 1, padding: 8 }}>
                    Отмена
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
