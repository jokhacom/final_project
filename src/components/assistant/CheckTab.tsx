"use client";

import { useState } from "react";
import { callApi, CheckView, FavButton, type ApiExtra, type CheckResult } from "./shared";

// «Проверь мой ответ»: сотрудник пишет ответ сам — ИИ находит ошибки по правилам компании и даёт исправленный вариант.
export function CheckTab({ disabled, onExtra }: { disabled: boolean; onExtra: (d: ApiExtra) => void }) {
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<(CheckResult & ApiExtra) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    setResult(null);
    const { ok, data } = await callApi<CheckResult>("/api/assistant", { mode: "check", message, draft });
    setLoading(false);
    onExtra(data);
    if (!ok) return setError(data.error ?? "Ошибка");
    setResult(data);
  }

  return (
    <div className="stack">
      <div className="card stack">
        <textarea
          className="textarea"
          rows={3}
          maxLength={3000}
          placeholder="Сообщение клиента (необязательно — так проверка точнее)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <textarea
          className="textarea"
          rows={5}
          maxLength={3000}
          placeholder="Ваш ответ клиенту — ИИ проверит его по правилам компании, орфографии и грамматике"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-primary" disabled={loading || disabled || !draft.trim()} onClick={check}>
            {loading ? "ИИ проверяет…" : "🔍 Проверить мой ответ"}
          </button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
      </div>
      {result && (
        <>
          {result.historyId && (
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <FavButton id={result.historyId} value={false} />
            </div>
          )}
          <CheckView check={result} />
        </>
      )}
    </div>
  );
}
