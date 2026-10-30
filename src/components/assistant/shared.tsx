"use client";

import { useState } from "react";
import type { LimitPeriod } from "@/lib/premium";

// Общие части страницы «Помощник ответов»: типы, запрос к API и карточки результатов (они же — в истории).
export type Limit = { limit: number; period: LimitPeriod; used: number; left: number } | null;
export type Achievement = { id: string; label: string; icon: string };
export type ReplyResult = { found: boolean; ru: string; uz: string; uzNew: string; note?: string };
export type CheckResult = { verdict: "good" | "fix"; issues: { quote: string; problem: string; rule: string }[]; fixed: string; comment: string };
export type CoachResult = {
  summary: string;
  focus: { rule: string; why: string; tip: string }[];
  exercises: { question: string; options: string[]; correctIndex: number; explanation: string }[];
};
export type HistoryItem = {
  id: string;
  mode: "reply" | "check" | "coach";
  input: string;
  draft: string | null;
  tone: string | null;
  result: ReplyResult & CheckResult & CoachResult;
  favorite: boolean;
  createdAt: string;
};

// Ответ API помощника: результат + остаток лимита, id записи в истории и новые достижения.
export type ApiExtra = { limit?: Limit; historyId?: string; achievements?: Achievement[]; error?: string };

export async function callApi<T>(url: string, body?: object): Promise<{ ok: boolean; data: T & ApiExtra }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const data = ((await res?.json().catch(() => ({}))) ?? {}) as T & ApiExtra;
  if (!res) data.error = "Нет связи — попробуйте ещё раз";
  return { ok: !!res?.ok, data };
}

export const TONES: { id: string; label: string }[] = [
  { id: "default", label: "Как в шаблонах" },
  { id: "official", label: "🎩 Официально" },
  { id: "friendly", label: "😊 Дружелюбно" },
  { id: "short", label: "✂️ Коротко" },
  { id: "angry", label: "😤 Клиент злится" },
];
export const toneLabel = (id: string | null) => TONES.find((t) => t.id === id)?.label ?? "";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "✅ Скопировано" : "📋 Копировать"}
    </button>
  );
}

// ⭐ — в избранное (запись истории).
export function FavButton({ id, value, onChange }: { id: string; value: boolean; onChange?: (v: boolean) => void }) {
  const [fav, setFav] = useState(value);
  return (
    <button
      className="btn btn-ghost btn-sm"
      title={fav ? "Убрать из избранного" : "В избранное"}
      onClick={async () => {
        const next = !fav;
        setFav(next);
        onChange?.(next);
        await fetch(`/api/assistant/history/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorite: next }) });
      }}
    >
      {fav ? "⭐ В избранном" : "☆ В избранное"}
    </button>
  );
}

const VERSIONS: { key: "ru" | "uz" | "uzNew"; label: string }[] = [
  { key: "ru", label: "🇷🇺 Русский" },
  { key: "uz", label: "🇺🇿 Oʻzbekcha" },
  { key: "uzNew", label: "🇺🇿 Yangi alifbo" },
];

export function ReplyView({ reply }: { reply: ReplyResult }) {
  return (
    <div className="stack">
      {!reply.found && <div className="alert alert-error">В шаблонах нет точного ответа на этот вопрос — ниже общий вежливый ответ. {reply.note}</div>}
      {reply.found && reply.note && <p className="muted small" style={{ margin: 0 }}>📎 {reply.note}</p>}
      {VERSIONS.map((v) => (
        <div key={v.key} className="card stack">
          <div className="row between">
            <strong>{v.label}</strong>
            <CopyButton text={reply[v.key]} />
          </div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{reply[v.key]}</div>
        </div>
      ))}
    </div>
  );
}

export function CheckView({ check }: { check: CheckResult }) {
  return (
    <div className="stack">
      <div className={`alert ${check.verdict === "good" ? "alert-success" : "alert-error"}`}>
        {check.verdict === "good" ? "✅ Ответ хороший — можно отправлять." : `✏️ Есть что исправить: ${check.issues.length}`}
        {check.comment && <div style={{ marginTop: 4 }}>{check.comment}</div>}
      </div>
      {check.issues.length > 0 && (
        <div className="card stack" style={{ gap: 10 }}>
          <strong>Что не так</strong>
          {check.issues.map((i, n) => (
            <div key={n} className="small" style={{ paddingTop: 8, borderTop: n ? "1px solid var(--border)" : undefined }}>
              {i.quote && (
                <div>
                  «<span style={{ color: "var(--danger)", fontWeight: 800 }}>{i.quote}</span>»
                </div>
              )}
              <div>{i.problem}</div>
              {i.rule && <div className="muted">📘 {i.rule}</div>}
            </div>
          ))}
        </div>
      )}
      <div className="card stack">
        <div className="row between">
          <strong>{check.verdict === "good" ? "Ваш ответ" : "✨ Исправленный ответ"}</strong>
          <CopyButton text={check.fixed} />
        </div>
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{check.fixed}</div>
      </div>
    </div>
  );
}

// План тренера и упражнения: ответ выбирается один раз, сразу видно верно или нет. onDone — все упражнения решены.
export function CoachView({ plan, onDone }: { plan: CoachResult; onDone?: () => void }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const right = plan.exercises.filter((q, i) => picked[i] === q.correctIndex).length;
  const done = plan.exercises.length > 0 && Object.keys(picked).length === plan.exercises.length;
  return (
    <div className="stack">
      {plan.summary && <div className="card">{plan.summary}</div>}
      {plan.focus.length > 0 && (
        <div className="card stack" style={{ gap: 10 }}>
          <strong>📌 Что повторить</strong>
          {plan.focus.map((f, i) => (
            <div key={i} className="small" style={{ paddingTop: 8, borderTop: i ? "1px solid var(--border)" : undefined }}>
              <div style={{ fontWeight: 800 }}>{f.rule}</div>
              {f.why && <div className="muted">{f.why}</div>}
              {f.tip && <div>💡 {f.tip}</div>}
            </div>
          ))}
        </div>
      )}
      {plan.exercises.length > 0 && (
        <div className="card stack">
          <div className="row between">
            <strong>🏋️ Упражнения</strong>
            <span className="muted small">
              {Object.keys(picked).length} из {plan.exercises.length}
            </span>
          </div>
          {plan.exercises.map((q, i) => (
            <div key={i} className="stack" style={{ gap: 6, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 800 }}>
                {i + 1}. {q.question}
              </div>
              {q.options.map((o, oi) => {
                const answered = picked[i] !== undefined;
                const state = !answered ? "" : oi === q.correctIndex ? "correct" : oi === picked[i] ? "wrong" : "";
                return (
                  <button
                    key={oi}
                    className="option"
                    disabled={answered}
                    style={{
                      textAlign: "left",
                      ...(state === "correct" ? { borderColor: "var(--success)", background: "var(--success-bg)" } : {}),
                      ...(state === "wrong" ? { borderColor: "var(--danger)", background: "var(--danger-bg)" } : {}),
                    }}
                    onClick={() => {
                      const next = { ...picked, [i]: oi };
                      setPicked(next);
                      if (Object.keys(next).length === plan.exercises.length) onDone?.();
                    }}
                  >
                    {o}
                  </button>
                );
              })}
              {picked[i] !== undefined && (
                <div className="small">
                  {picked[i] === q.correctIndex ? "✅ Верно. " : "❌ Неверно. "}
                  <span className="muted">{q.explanation}</span>
                </div>
              )}
            </div>
          ))}
          {done && (
            <div className="alert alert-success">
              Готово: {right} из {plan.exercises.length} верно. {right === plan.exercises.length ? "Отлично! 🎉" : "Повторите правила выше и попробуйте пройти тест."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
