"use client";

import { useEffect, useState } from "react";

type Reply = { found: boolean; ru: string; uz: string; uzNew: string; note?: string };

const VERSIONS: { key: "ru" | "uz" | "uzNew"; label: string }[] = [
  { key: "ru", label: "🇷🇺 Русский" },
  { key: "uz", label: "🇺🇿 Oʻzbekcha" },
  { key: "uzNew", label: "🇺🇿 Yangi alifbo" },
];

// «Помощник ответов» (премиум): сотрудник вставляет сообщение клиента — ИИ даёт готовый ответ по шаблонам компании.
export default function AssistantPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/assistant").then((r) => r.json()).then((d) => setAllowed(!!d.allowed)).catch(() => setAllowed(false));
  }, []);

  async function ask() {
    setLoading(true);
    setError(null);
    setReply(null);
    const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setLoading(false);
    if (!res?.ok) return setError(d?.error ?? "Нет связи — попробуйте ещё раз");
    setReply(d);
  }

  async function copy(key: string, text: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  if (allowed === null) return <main className="container narrow"><div className="spinner" /></main>;
  if (!allowed)
    return (
      <main className="container narrow">
        <div className="card center stack">
          <div style={{ fontSize: 48 }}>⭐</div>
          <h1 style={{ margin: 0 }}>Помощник ответов</h1>
          <p className="muted">Это премиум-функция: ИИ составляет готовый ответ клиенту по шаблонам компании. Чтобы получить доступ, обратитесь к администратору.</p>
        </div>
      </main>
    );

  return (
    <main className="container narrow stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>🤖 Помощник ответов</h1>
        <p className="muted" style={{ margin: 0 }}>Вставьте сообщение клиента — ИИ составит ответ по шаблонам и правилам компании. Перед отправкой проверьте ответ.</p>
      </div>

      <div className="card stack">
        <textarea
          className="textarea"
          rows={5}
          maxLength={3000}
          placeholder="Сообщение клиента, например: «Здравствуйте, деньги списались два раза, что делать?»"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && message.trim() && !loading) ask();
          }}
        />
        <div className="row between">
          <span className="muted small">Ctrl + Enter — получить ответ</span>
          <button className="btn btn-primary" disabled={loading || !message.trim()} onClick={ask}>
            {loading ? "ИИ составляет ответ…" : "✨ Получить ответ"}
          </button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
      </div>

      {reply && (
        <>
          {!reply.found && (
            <div className="alert alert-error">
              В шаблонах нет точного ответа на этот вопрос — ниже общий вежливый ответ. {reply.note}
            </div>
          )}
          {reply.found && reply.note && <p className="muted small" style={{ margin: 0 }}>📎 {reply.note}</p>}
          {VERSIONS.map((v) => (
            <div key={v.key} className="card stack">
              <div className="row between">
                <strong>{v.label}</strong>
                <button className="btn btn-ghost btn-sm" onClick={() => copy(v.key, reply[v.key])}>
                  {copied === v.key ? "✅ Скопировано" : "📋 Копировать"}
                </button>
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{reply[v.key]}</div>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
