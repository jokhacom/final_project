"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { LEVELS, OPEN_QUESTION_SECONDS, levelInfo, type LevelId } from "@/lib/levels";
import { useAdminStatus } from "@/components/admin/useAdminStatus";
import { addMonths, formatDay, premiumState, tashkentToday } from "@/lib/premium";

type User = { id: string; name: string; username: string; role: string; premium: boolean; premiumFrom: string | null; premiumUntil: string | null; leaderboard: { testsDone: number; bestCandy: number } | null };

const ROLE_LABEL: Record<string, string> = { EMPLOYEE: "Сотрудник", ADMIN: "Администратор", SUPERADMIN: "Суперадмин" };

// Обзор админ-панели: выгрузка результатов в Excel, список сотрудников и настройки.
type LevelCfg = { count: string; minutes: string; attempts: string; open: string };

export default function AdminHome() {
  const { data: session } = useSession();
  const isSuper = (session?.user as any)?.role === "SUPERADMIN";
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dailyQuiz, setDailyQuiz] = useState<boolean | null>(null);
  const [minutesSaved, setMinutesSaved] = useState<string | null>(null);
  // Настройки теста для каждого уровня: вопросов, минут на тест, попыток (0 — без ограничений),
  // минут на один открытый вопрос (можно 1.5). Строки — чтобы поле можно было стереть и ввести заново.
  const [levelCfg, setLevelCfg] = useState<Record<LevelId, LevelCfg>>(
    Object.fromEntries(
      LEVELS.map((l) => [l.id, { count: "10", minutes: "15", attempts: "0", open: String(OPEN_QUESTION_SECONDS[l.id] / 60) }])
    ) as Record<LevelId, LevelCfg>
  );
  const setCfg = (level: LevelId, field: keyof LevelCfg, value: string) =>
    setLevelCfg((all) => ({ ...all, [level]: { ...all[level], [field]: value } }));
  // Максимум пользователей сайта (0 — без ограничений) и сколько их сейчас (без суперадминистратора).
  const [maxUsers, setMaxUsers] = useState("0");
  const [userCount, setUserCount] = useState(0);
  // Таймеры в играх, секунды на один ответ.
  const [gameSec, setGameSec] = useState<Record<string, string>>({ TRUE_FALSE: "10", FIX_ERROR: "90", LANGUAGE: "10" });
  const status = useAdminStatus();
  const [userMsg, setUserMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Окно «Премиум для …: с — по»: открывается при включении галочки или по ✏️ у срока.
  const [premiumEdit, setPremiumEdit] = useState<{ user: User; from: string; until: string } | null>(null);
  const loadUsers = () =>
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users ?? []);
        setUserCount(d.counted ?? 0);
      });

  async function userAction(u: User, method: "PATCH" | "DELETE", body?: object, okText?: string) {
    setUserMsg(null);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setUserMsg(res.ok ? { ok: true, text: okText ?? "Готово" } : { ok: false, text: data.error ?? "Ошибка" });
    loadUsers();
    return res.ok;
  }

  function removeUser(u: User) {
    if (!confirm(`Удалить ${u.name} (@${u.username})? Его результаты и обращения тоже удалятся. Отменить нельзя.`)) return;
    userAction(u, "DELETE", undefined, `${u.name} удалён`);
  }

  function resetPassword(u: User) {
    const password = prompt(`Новый пароль для ${u.name} (не короче 6 символов):`);
    if (!password) return;
    userAction(u, "PATCH", { password }, `Пароль для ${u.name} изменён — сообщите его сотруднику`);
  }

  useEffect(() => {
    loadUsers();
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const list = d.settings ?? [];
        setDailyQuiz(list.some((s: any) => s.key === "daily_quiz_enabled" && s.value === "true"));
        // Значение уровня, если задано, иначе прежнее общее.
        const val = (key: string, level: LevelId) =>
          (list.find((s: any) => s.key === `${key}_${level}`) ?? list.find((s: any) => s.key === key))?.value as string | undefined;
        setLevelCfg((prev) => {
          const next = { ...prev };
          for (const l of LEVELS) {
            next[l.id] = {
              count: val("test_question_count", l.id) ?? prev[l.id].count,
              minutes: val("test_duration_min", l.id) ?? prev[l.id].minutes,
              attempts: val("test_attempt_limit", l.id) ?? prev[l.id].attempts,
              open: list.find((s: any) => s.key === `open_question_min_${l.id}`)?.value ?? prev[l.id].open,
            };
          }
          return next;
        });
        const mu = list.find((s: any) => s.key === "max_users");
        if (mu) setMaxUsers(mu.value);
        setGameSec((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(prev)) {
            const v = list.find((s: any) => s.key === `game_seconds_${k}`);
            if (v) next[k] = v.value;
          }
          return next;
        });
      });
  }, []);

  const exportUrl = `/api/admin/export?${new URLSearchParams({ ...(userId && { userId }), ...(from && { from }), ...(to && { to }) })}`;

  async function saveMinutes() {
    setMinutesSaved(null);
    for (const [key, value] of [
      ...LEVELS.flatMap((l) => [
        [`test_question_count_${l.id}`, levelCfg[l.id].count.trim()],
        [`test_duration_min_${l.id}`, levelCfg[l.id].minutes.trim()],
        [`test_attempt_limit_${l.id}`, levelCfg[l.id].attempts.trim() || "0"],
        [`open_question_min_${l.id}`, levelCfg[l.id].open.trim()],
      ]),
      ["max_users", maxUsers.trim() || "0"],
      ...Object.entries(gameSec).map(([k, v]) => [`game_seconds_${k}`, v.trim()]),
    ]) {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMinutesSaved(data.error ?? "Не удалось сохранить");
    }
    setMinutesSaved("Сохранено — действует для новых попыток");
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
          hint: !l.ready
            ? "нет вопросов — уровень скрыт у сотрудников"
            : l.full
              ? undefined
              : `в тесте будет ${l.inTest} из ${l.needed} (сколько есть)`,
        })),
        {
          ok: status.ai.configured,
          optional: true,
          label: status.ai.configured
            ? `ИИ подключён: ${status.ai.chain[0]}${status.ai.chain.length > 1 ? `, запасной — ${status.ai.chain.slice(1).join(", ")}` : ""}. Проверка ответов: ${status.ai.gradingMode === "ai" ? "через ИИ" : "по ключевым словам"}`
            : `ИИ не подключён — добавьте ${status.ai.keyEnv} в Vercel (сейчас проверка по ключевым словам)`,
        },
        {
          ok: status.pendingReviews === 0,
          optional: true,
          label: status.pendingReviews ? `Открытых ответов ждут ручной проверки: ${status.pendingReviews} — «Проверка»` : "Все открытые ответы проверены",
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
        {isSuper && (
          <p className="muted small">Администратор видит админ-панель: вопросы, аналитику, выгрузку и обратную связь. Материалы и настройки — только у вас.</p>
        )}
        {userMsg && <div className={`alert ${userMsg.ok ? "alert-success" : "alert-error"}`} style={{ marginBottom: 12 }}>{userMsg.text}</div>}
        {premiumEdit && (
          <div className="card stack" style={{ marginBottom: 12, border: "1px solid var(--border)" }}>
            <strong>⭐ Премиум для {premiumEdit.user.name}</strong>
            <div className="row" style={{ gap: 10 }}>
              <label className="small">
                с{" "}
                <input
                  type="date"
                  className="input"
                  style={{ width: "auto" }}
                  value={premiumEdit.from}
                  onChange={(e) => setPremiumEdit({ ...premiumEdit, from: e.target.value })}
                />
              </label>
              <label className="small">
                по{" "}
                <input
                  type="date"
                  className="input"
                  style={{ width: "auto" }}
                  value={premiumEdit.until}
                  min={premiumEdit.from || undefined}
                  onChange={(e) => setPremiumEdit({ ...premiumEdit, until: e.target.value })}
                />
              </label>
              {[
                [1, "+1 месяц"],
                [3, "+3 месяца"],
                [12, "+1 год"],
              ].map(([m, label]) => (
                <button
                  key={m}
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPremiumEdit({ ...premiumEdit, until: addMonths(premiumEdit.from || tashkentToday(), m as number) })}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="muted small">Обе даты включительно. Пустое поле — без ограничения (например, без «по» — бессрочно).</div>
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const { user, from, until } = premiumEdit;
                  const period = from || until ? `${from ? ` с ${formatDay(from)}` : ""}${until ? ` по ${formatDay(until)}` : ""}` : " бессрочно";
                  userAction(user, "PATCH", { premium: true, premiumFrom: from || null, premiumUntil: until || null }, `${user.name}: премиум${period}`).then(
                    (ok) => ok && setPremiumEdit(null)
                  );
                }}
              >
                Сохранить
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPremiumEdit(null)}>
                Отмена
              </button>
            </div>
          </div>
        )}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Логин</th>
                <th>Роль</th>
                <th title="Доступ к «Помощнику ответов»">⭐ Премиум</th>
                <th>Тестов</th>
                <th>Лучший</th>
                {isSuper && <th></th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="muted">@{u.username}</td>
                  <td>
                    {isSuper && u.role !== "SUPERADMIN" ? (
                      <select
                        className="select"
                        style={{ padding: "6px 10px", width: "auto" }}
                        value={u.role}
                        onChange={(e) => userAction(u, "PATCH", { role: e.target.value }, `Роль ${u.name} изменена`)}
                      >
                        <option value="EMPLOYEE">Сотрудник</option>
                        <option value="ADMIN">Администратор</option>
                      </select>
                    ) : (
                      ROLE_LABEL[u.role] ?? u.role
                    )}
                  </td>
                  <td>
                    {u.role !== "EMPLOYEE" ? (
                      <span className="muted small" title="Администраторам помощник доступен всегда">всегда</span>
                    ) : (
                      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                        <input
                          type="checkbox"
                          checked={u.premium}
                          disabled={!isSuper}
                          aria-label={`Премиум для ${u.name}`}
                          onChange={(e) =>
                            e.target.checked
                              ? setPremiumEdit({ user: u, from: tashkentToday(), until: "" })
                              : userAction(u, "PATCH", { premium: false }, `${u.name}: премиум выключен`)
                          }
                        />
                        {u.premium && <PremiumPeriod u={u} />}
                        {u.premium && isSuper && (
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Изменить срок"
                            onClick={() => setPremiumEdit({ user: u, from: u.premiumFrom ?? "", until: u.premiumUntil ?? "" })}
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td>{u.leaderboard?.testsDone ?? 0}</td>
                  <td>{u.leaderboard ? `${u.leaderboard.bestCandy} 🍬` : "—"}</td>
                  {isSuper && (
                    <td>
                      {u.role !== "SUPERADMIN" && (
                        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Сбросить попытки — сотрудник снова сможет пройти тесты (история сохранится)"
                            onClick={() => {
                              if (confirm(`Сбросить попытки ${u.name}? Сотрудник снова сможет пройти все уровни, история результатов сохранится.`))
                                userAction(u, "PATCH", { resetAttempts: true }, `Попытки ${u.name} сброшены`);
                            }}
                          >
                            🔄
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => resetPassword(u)} title="Сбросить пароль">
                            🔑
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => removeUser(u)} title="Удалить">
                            Удалить
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isSuper && dailyQuiz !== null && (
        <div className="card">
          <h2>⚙️ Настройки</h2>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800 }}>Тесты по уровням</div>
            <div className="muted small">
              Для каждого уровня отдельно: сколько вопросов в тесте, сколько минут на весь тест, сколько раз сотрудник может его пройти (0 — без
              ограничений; администраторов лимит не касается) и сколько минут на один открытый вопрос (можно дробно: 1.5). Вопросы делятся пополам:
              с вариантами и открытые. Уже начатые попытки не меняются.
            </div>
            {minutesSaved && <div className="small" style={{ marginTop: 4 }}>{minutesSaved}</div>}
            <div className="table-wrap mt">
              <table className="table">
                <thead>
                  <tr>
                    <th>Уровень</th>
                    <th>Вопросов</th>
                    <th>Минут на тест</th>
                    <th>Попыток</th>
                    <th>Минут на открытый вопрос ✍️</th>
                  </tr>
                </thead>
                <tbody>
                  {LEVELS.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 800 }}>
                        {l.icon} {l.id === "EXAM" ? "Итоговый экзамен" : l.label}
                      </td>
                      {(
                        [
                          ["count", "numeric", /\D/g],
                          ["minutes", "numeric", /\D/g],
                          ["attempts", "numeric", /\D/g],
                          ["open", "decimal", /[^\d.,]/g],
                        ] as const
                      ).map(([field, mode, strip]) => (
                        <td key={field}>
                          <input
                            className="input"
                            style={{ width: 80 }}
                            inputMode={mode}
                            value={levelCfg[l.id][field]}
                            onChange={(e) => setCfg(l.id, field, e.target.value.replace(strip, ""))}
                            aria-label={`${l.label}: ${field}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Таймеры в играх 🎮</div>
              <div className="muted small">Секунд на один ответ в «Обучении». Не успел — ответ засчитывается как неверный.</div>
            </div>
            <div className="row">
              {[
                ["TRUE_FALSE", "Можно или нельзя?"],
                ["FIX_ERROR", "Найди и исправь"],
                ["LANGUAGE", "Грамотность"],
              ].map(([k, label]) => (
                <label key={k} className="row small" style={{ gap: 4 }}>
                  <span className="muted">{label}</span>
                  <input
                    className="input"
                    style={{ width: 70 }}
                    inputMode="numeric"
                    value={gameSec[k]}
                    onChange={(e) => setGameSec({ ...gameSec, [k]: e.target.value.replace(/\D/g, "") })}
                  />
                </label>
              ))}
              <span className="muted small">сек</span>
            </div>
          </div>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Пользователи сайта 👥</div>
              <div className="muted small">
                Максимум аккаунтов (кроме суперадминистратора), 0 — без ограничений. Когда лимит достигнут, новая регистрация закрывается; уже
                созданные аккаунты работают. Сейчас: <strong>{userCount}</strong>
                {Number(maxUsers) > 0 ? ` из ${maxUsers}` : ""}.
              </div>
            </div>
            <div className="row">
              <input
                className="input"
                style={{ width: 90 }}
                inputMode="numeric"
                value={maxUsers}
                onChange={(e) => setMaxUsers(e.target.value.replace(/\D/g, ""))}
              />
              <span className="muted small">пользователей</span>
            </div>
          </div>
          <div className="row" style={{ marginBottom: 16, justifyContent: "flex-end" }}>
            <button className="btn btn-primary btn-sm" onClick={saveMinutes}>
              Сохранить настройки
            </button>
          </div>
          <div className="row between">
            <div>
              <div style={{ fontWeight: 800 }}>☀️ Вопросы дня (3 вопроса)</div>
              <div className="muted small">
                Карточка вверху страницы «Уровни»: раз в день у каждого сотрудника 3 своих вопроса с вариантами ответа из банка, ответ сразу с
                пояснением, без конфет; серия дней подряд 🔥.
              </div>
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

// Срок премиума в таблице сотрудников: «до 30.11.2026», «с 01.12.2026», «истёк 30.10.2026» или «бессрочно».
function PremiumPeriod({ u }: { u: User }) {
  const state = premiumState(u);
  const text =
    state === "soon"
      ? `с ${formatDay(u.premiumFrom!)}`
      : state === "expired"
        ? `истёк ${formatDay(u.premiumUntil!)}`
        : u.premiumUntil
          ? `до ${formatDay(u.premiumUntil)}`
          : "бессрочно";
  return (
    <span className="small" style={{ whiteSpace: "nowrap", color: state === "expired" ? "var(--danger)" : state === "soon" ? "var(--muted)" : undefined }}>
      {text}
    </span>
  );
}
