"use client";

import { useState } from "react";
import { callApi, CoachView, type Achievement, type ApiExtra, type CoachResult } from "./shared";

// Отметить, что упражнения тренера решены (достижение «🎯 С тренером»).
export async function markCoachDone(historyId: string): Promise<Achievement[]> {
  const res = await fetch(`/api/assistant/history/${historyId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coachDone: true }),
  }).catch(() => null);
  const d = await res?.json().catch(() => ({}));
  return d?.achievements ?? [];
}

// «Личный тренер»: ИИ смотрит ошибки сотрудника в тестах и даёт план + упражнения по слабым правилам.
export function CoachTab({ disabled, onExtra }: { disabled: boolean; onExtra: (d: ApiExtra) => void }) {
  const [plan, setPlan] = useState<(CoachResult & ApiExtra) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    setPlan(null);
    const { ok, data } = await callApi<CoachResult>("/api/assistant/coach");
    setLoading(false);
    onExtra(data);
    if (!ok) return setError(data.error ?? "Ошибка");
    setPlan(data);
  }

  return (
    <div className="stack">
      <div className="card stack">
        <div>
          <strong>🎯 Личный тренер</strong>
          <p className="muted small" style={{ margin: "4px 0 0" }}>
            ИИ посмотрит ваши ошибки в тестах, подскажет, какие правила повторить, и даст 5 упражнений именно по ним. Это один ответ из лимита.
          </p>
        </div>
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={loading || disabled} onClick={start}>
          {loading ? "Тренер смотрит ваши ошибки…" : plan ? "🔄 Новый план" : "🎯 Получить план"}
        </button>
        {error && <div className="alert alert-error">{error}</div>}
      </div>
      {plan && <CoachView plan={plan} onDone={() => plan.historyId && markCoachDone(plan.historyId).then((achievements) => onExtra({ achievements }))} />}
    </div>
  );
}
