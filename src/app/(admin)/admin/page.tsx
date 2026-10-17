"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { levelInfo } from "@/lib/levels";
import { useAdminStatus } from "@/components/admin/useAdminStatus";

type User = { id: string; name: string; username: string; role: string; leaderboard: { testsDone: number; bestCandy: number } | null };

const ROLE_LABEL: Record<string, string> = { EMPLOYEE: "Сотрудник", ADMIN: "Администратор", SUPERADMIN: "Суперадмин" };

// Обзор админ-панели: выгрузка результатов в Excel, список сотрудников и настройки.
export default function AdminHome() {
  const { data: session } = useSession();
  const isSuper = (session?.user as any)?.role === "SUPERADMIN";
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dailyQuiz, setDailyQuiz] = useState<boolean | null>(null);
  const [minutes, setMinutes] = useState("15");
  const [minutesSaved, setMinutesSaved] = useState<string | null>(null);
  const status = useAdminStatus();

  useEffect(() => {
    fetch("/api/admin/users").then((r) => r.json()).then((d) => setUsers(d.users ?? []));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const list = d.settings ?? [];
        setDailyQuiz(list.some((s: any) => s.key === "daily_quiz_enabled" && s.value === "true"));
        const dur = list.find((s: any) => s.key === "test_duration_min");
        if (dur) setMinutes(dur.value);
      });
  }, []);

  const exportUrl = `/api/admin/export?${new URLSearchParams({ ...(userId && { userId }), ...(from && { from }), ...(to && { to }) })}`;

  async function saveMinutes() {
    setMinutesSaved(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "test_duration_min", value: minutes.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setMinutesSaved(res.ok ? "Сохранено — действует для новых попыток" : data.error ?? "Не удалось сохранить");
  }

  async function toggleDailyQuiz() {
    const next = !dailyQuiz;
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "daily_quiz_enabled", value: String(next) }),
    });
    if (res.ok) setDailyQuiz(next);
  }

  const checks = status
    ? [
        { ok: status.superadmin, label: "Суперадминистратор создан" },
        ...status.levels.map((l) => ({
          ok: l.ready,
          label: `${levelInfo(l.id).label}: ${l.total} вопросов (${l.choice} с вариантами, ${l.open} открытых)`,
          hint: l.ready ? (l.balanced ? undefined : "лучше минимум 5 + 5") : l.id === "EXAM" ? "нужно 3 / 3 / 4 вопроса по уровням" : "нужно минимум 10",
        })),
        {
          ok: status.ai.configured,
          optional: true,
          label: status.ai.configured
            ? `ИИ подключён (${status.ai.provider}), проверка ответов: ${status.ai.gradingMode === "ai" ? "через ИИ" : "по ключевым словам"}`
            : `ИИ не подключён — добавьте ${status.ai.keyEnv} в Vercel (сейчас проверка по ключевым словам)`,
        },
        { ok: status.email, optional: true, label: status.email ? "Обратная связь дублируется на почту" : "Почта для обратной связи не настроена (обращения видны в админке)" },
      ]
    : [];

  return (
    <div className="stack">
      {status && (
        <div className="card">
          <div className="row between">
            <h2 style={{ margin: 0 }}>🚀 Готовность к запуску</h2>
            <Link href="/admin/questions" className="btn btn-ghost btn-sm">
              Добавить вопросы →
            </Link>
          </div>
          <div className="stack mt" style={{ gap: 8 }}>
            {checks.map((c, i) => (
              <div key={i} className="row small" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                <span>{c.ok ? "✅" : (c as any).optional ? "⚪" : "❌"}</span>
                <span>
                  {c.label}
                  {(c as any).hint && <span className="muted"> — {(c as any).hint}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>📊 Выгрузка результатов в Excel</h2>
        <div className="grid grid-4">
          <label className="field">
            Сотрудник
            <select className="select" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Все сотрудники</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} (@{u.username})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            С даты
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            По дату
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div className="field" style={{ justifyContent: "flex-end" }}>
            <a className="btn btn-primary" href={exportUrl}>
              ⬇️ Скачать .xlsx
            </a>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>👥 Сотрудники ({users.length})</h2>
        <p className="muted small">
          Роль администратора выдаётся через базу данных: <code>UPDATE &quot;User&quot; SET role = &apos;ADMIN&apos; WHERE username = &apos;...&apos;</code>
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Логин</th>
                <th>Роль</th>
                <th>Тестов</th>
                <th>Лучший</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="muted">@{u.username}</td>
                  <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td>{u.leaderboard?.testsDone ?? 0}</td>
                  <td>{u.leaderboard ? `${u.leaderboard.bestCandy} 🍬` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isSuper && dailyQuiz !== null && (
        <div className="card">
          <h2>⚙️ Настройки</h2>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Время на тест</div>
              <div className="muted small">Сколько минут даётся на 10 вопросов (от 1 до 120). Уже начатые попытки не меняются.</div>
              {minutesSaved && <div className="small" style={{ marginTop: 4 }}>{minutesSaved}</div>}
            </div>
            <div className="row">
              <input className="input" style={{ width: 90 }} type="number" min={1} max={120} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              <span className="muted small">мин</span>
              <button className="btn btn-primary btn-sm" onClick={saveMinutes}>
                Сохранить
              </button>
            </div>
          </div>
          <div className="row between">
            <div>
              <div style={{ fontWeight: 800 }}>Ежедневный мини-тест (3 вопроса)</div>
              <div className="muted small">API: /api/daily-quiz</div>
            </div>
            <button className={`btn ${dailyQuiz ? "btn-primary" : "btn-ghost"}`} onClick={toggleDailyQuiz}>
              {dailyQuiz ? "Включён" : "Выключен"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
