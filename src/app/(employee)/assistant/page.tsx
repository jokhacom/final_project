"use client";

import { useEffect, useState } from "react";
import { formatDay, LIMIT_PERIOD_LABEL, type PremiumState } from "@/lib/premium";
import { CheckTab } from "@/components/assistant/CheckTab";
import { CoachTab } from "@/components/assistant/CoachTab";
import { HistoryTab } from "@/components/assistant/HistoryTab";
import { ReplyTab } from "@/components/assistant/ReplyTab";
import type { Achievement, ApiExtra, Limit } from "@/components/assistant/shared";

type Access = { allowed: boolean; premium: boolean; state: PremiumState; from: string | null; until: string | null; limit: Limit };

const TABS = [
  { id: "reply", label: "✨ Ответ клиенту" },
  { id: "check", label: "🔍 Проверь мой ответ" },
  { id: "coach", label: "🎯 Личный тренер" },
  { id: "history", label: "📚 История" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// «Помощник ответов» (премиум): ответ клиенту по шаблонам (текст или скриншот, нужный тон), проверка своего ответа,
// личный тренер по ошибкам в тестах и история с избранным.
export default function AssistantPage() {
  const [access, setAccess] = useState<Access | null>(null);
  const [tab, setTab] = useState<TabId>("reply");
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    fetch("/api/assistant")
      .then((r) => r.json())
      .then((d) => setAccess({ allowed: !!d.allowed, premium: !!d.premium, state: d.state ?? "off", from: d.from ?? null, until: d.until ?? null, limit: d.limit ?? null }))
      .catch(() => setAccess({ allowed: false, premium: false, state: "off", from: null, until: null, limit: null }));
  }, []);

  // Остаток лимита приходит и с ответом, и с отказом «лимит исчерпан»; новые достижения — показать сверху.
  function onExtra(d: ApiExtra) {
    if (d.limit !== undefined) setAccess((a) => (a ? { ...a, limit: d.limit ?? null } : a));
    if (d.achievements?.length) setNewAchievements((list) => [...list, ...d.achievements!]);
  }

  if (!access) return <main className="container narrow"><div className="spinner" /></main>;
  if (!access.allowed)
    return (
      <main className="container narrow">
        <div className="card center stack">
          <div style={{ fontSize: 48 }}>⭐</div>
          <h1 style={{ margin: 0 }}>Помощник ответов</h1>
          {access.state === "soon" && access.from ? (
            <p className="muted">Ваш премиум начнётся {formatDay(access.from)}. До этого дня помощник недоступен.</p>
          ) : access.state === "expired" && access.until ? (
            <p className="muted">Срок премиума закончился {formatDay(access.until)}. Чтобы продлить, обратитесь к администратору.</p>
          ) : (
            <p className="muted">Это премиум-функция: ИИ составляет готовый ответ клиенту по шаблонам компании. Чтобы получить доступ, обратитесь к администратору.</p>
          )}
        </div>
      </main>
    );

  const noAnswersLeft = access.limit?.left === 0;
  return (
    <main className="container narrow stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>
          🤖 Помощник ответов {access.premium && <span className="premium-badge" style={{ fontSize: 14 }}>⭐ Премиум</span>}
        </h1>
        <p className="muted" style={{ margin: 0 }}>Ответы по шаблонам и правилам компании. Перед отправкой клиенту проверьте ответ.</p>
        {(access.until || access.limit) && (
          <p className="muted small" style={{ margin: "4px 0 0" }}>
            {[
              access.until && `⭐ Премиум до ${formatDay(access.until)}`,
              access.limit && `Осталось ответов: ${access.limit.left} из ${access.limit.limit} ${LIMIT_PERIOD_LABEL[access.limit.period]}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      {newAchievements.map((a) => (
        <div key={a.id} className="alert alert-success row between">
          <span>
            🏆 Новое достижение: {a.icon} <strong>{a.label}</strong>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setNewAchievements((l) => l.filter((x) => x.id !== a.id))}>
            ✕
          </button>
        </div>
      ))}

      <div className="tabs" style={{ flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {noAnswersLeft && tab !== "history" && <div className="alert alert-error">Лимит ответов исчерпан. История и избранное доступны.</div>}

      {/* Вкладки не размонтируются — введённый текст и результат сохраняются при переключении. */}
      <div hidden={tab !== "reply"}>
        <ReplyTab disabled={noAnswersLeft} onExtra={onExtra} />
      </div>
      <div hidden={tab !== "check"}>
        <CheckTab disabled={noAnswersLeft} onExtra={onExtra} />
      </div>
      <div hidden={tab !== "coach"}>
        <CoachTab disabled={noAnswersLeft} onExtra={onExtra} />
      </div>
      {tab === "history" && <HistoryTab onExtra={onExtra} />}
    </main>
  );
}
