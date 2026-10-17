"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

// Плавающая кнопка «💬 Обратная связь» на каждой странице (для вошедших сотрудников).
export default function FeedbackButton() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("предложение");
  const [description, setDescription] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session || pathname?.startsWith("/test/") || pathname?.startsWith("/certificate/")) return null;

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось отправить");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  function close() {
    setOpen(false);
    setSent(false);
    setDescription("");
    setError(null);
  }

  return (
    <>
      <button className="btn btn-primary fab" onClick={() => setOpen(true)}>
        💬 Обратная связь
      </button>

      {open && (
        <div className="modal-backdrop" onClick={close}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            {sent ? (
              <div className="center stack">
                <div style={{ fontSize: 44 }}>🎉</div>
                <p>Спасибо! Сообщение отправлено администратору. Вы помогаете сделать платформу лучше ❤️</p>
                <button className="btn btn-primary" onClick={close}>
                  Закрыть
                </button>
              </div>
            ) : (
              <div className="stack">
                <h2>Обратная связь</h2>
                <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="ошибка">🐞 Ошибка</option>
                  <option value="предложение">💡 Предложение</option>
                  <option value="вопрос">❓ Вопрос</option>
                  <option value="другое">✉️ Другое</option>
                </select>
                <textarea
                  className="textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Опишите, что случилось или что можно улучшить"
                  rows={5}
                />
                {error && <div className="alert alert-error">{error}</div>}
                <div className="row">
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={sending || !description.trim()}>
                    {sending ? "Отправляем..." : "Отправить"}
                  </button>
                  <button className="btn btn-ghost" onClick={close}>
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
