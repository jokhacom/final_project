"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { levelInfo } from "@/lib/levels";
import { BarList, ColumnChart, LineChart } from "@/components/charts";

const PERIODS = [
  { days: 7, label: "7 дней" },
  { days: 30, label: "30 дней" },
  { days: 90, label: "90 дней" },
  { days: 0, label: "Всё время" },
];

const shortDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
const tests = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "тест" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "теста" : "тестов"}`;

export default function AdminAnalyticsPage() {
  const { data: session } = useSession();
  const isSuper = (session?.user as any)?.role === "SUPERADMIN";
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(30);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setData(null);
    fetch(`/api/admin/analytics?days=${days}`).then((r) => r.json()).then(setData);
  }, [days, reload]);

  async function remove(ids: string[]) {
    if (!ids.length) return;
    const text =
      ids.length === 1
        ? "Удалить этот результат? Он пропадёт из рейтинга и аналитики, а попытка вернётся сотруднику."
        : `Удалить выбранные результаты (${ids.length})? Они пропадут из рейтинга и аналитики, а попытки вернутся сотрудникам.`;
    if (!confirm(text)) return;
    const res = await fetch("/api/admin/analytics", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: `Удалено результатов: ${d.deleted}` } : { ok: false, text: d.error ?? "Не удалось удалить" });
    setSelected(new Set());
    setReload((n) => n + 1);
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="stack">
      {/* Фильтр периода и выгрузка — одной строкой над графиками */}
      <div className="row between">
        <div className="tabs" style={{ maxWidth: 480 }}>
          {PERIODS.map((p) => (
            <button key={p.days} className={days === p.days ? "active" : ""} onClick={() => setDays(p.days)}>
              {p.label}
            </button>
          ))}
        </div>
        <a className="btn btn-primary btn-sm" href={`/api/admin/analytics/export?days=${days}`}>
          ⬇️ Скачать аналитику (Excel)
        </a>
      </div>

      {msg && <div className={`alert ${msg.ok ? "alert-success" : "alert-error"}`}>{msg.text}</div>}

      {!data ? (
        <div className="card">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="grid grid-4">
            {[
              { label: "Сотрудников", value: data.employees },
              { label: "Пройдено тестов", value: data.testsDone },
              { label: "Средний результат", value: `${data.avgTeamCandy} 🍬` },
              { label: "Результатов больше 90 🍬", value: data.certificates },
            ].map((t) => (
              <div key={t.label} className="card center">
                <div style={{ fontSize: 28, fontWeight: 900 }}>{t.value}</div>
                <div className="muted small">{t.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-2">
            <div className="card">
              <h2>Тестов по дням</h2>
              <ColumnChart
                data={data.daily.map((d: any) => ({ label: shortDate(d.date), value: d.tests, tip: `${shortDate(d.date)}: ${tests(d.tests)}` }))}
              />
            </div>
            <div className="card">
              <h2>Средний результат по дням</h2>
              <p className="muted small" style={{ marginTop: -8 }}>Конфет из 100; дни без тестов — пропуск</p>
              <LineChart
                data={data.daily.map((d: any) => ({
                  label: shortDate(d.date),
                  value: d.avg,
                  tip: d.avg === null ? `${shortDate(d.date)}: тестов не было` : `${shortDate(d.date)}: ${d.avg} 🍬 (${tests(d.tests)})`,
                }))}
              />
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <h2>Средний результат по уровням</h2>
              {data.testsDone === 0 && <p className="muted small">Данных пока нет</p>}
              <BarList
                rows={data.byLevel
                  .filter((l: any) => l.tests > 0)
                  .map((l: any) => ({
                    label: `${levelInfo(l.level).icon} ${levelInfo(l.level).label}`,
                    value: l.avg,
                    display: `${l.avg} 🍬 · ${tests(l.tests)} · лучший ${l.best}`,
                    color: `var(--lvl-${l.level})`,
                  }))}
              />
            </div>
            <div className="card">
              <h2>Сотрудники: средний результат</h2>
              {data.byEmployee.length === 0 && <p className="muted small">Данных пока нет</p>}
              <BarList
                rows={data.byEmployee.slice(0, 15).map((e: any) => ({
                  label: e.name,
                  value: e.avg,
                  display: `${e.avg} 🍬 · ${tests(e.tests)} · лучший ${e.best}`,
                }))}
              />
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <h2>Самые сложные вопросы</h2>
              <p className="muted small">Доля неверных ответов (от 3 ответов)</p>
              {data.hardestQuestions.length === 0 && <p className="muted small">Данных пока нет</p>}
              {data.hardestQuestions.map((q: any) => (
                <div key={q.id} className="small" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontWeight: 900, color: "var(--danger)" }}>{q.wrongPercent}%</span> · {q.text}
                </div>
              ))}
            </div>
            <div className="card">
              <h2>Частые слабые темы</h2>
              {data.hardestTopics.length === 0 && <p className="muted small">Данных пока нет</p>}
              {data.hardestTopics.map((t: any, i: number) => (
                <div key={i} className="row between small" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <span style={{ flex: 1 }}>{t.topic}</span>
                  <span className="badge" style={{ flex: "none" }}>{t.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="row between">
              <h2 style={{ margin: 0 }}>Результаты</h2>
              {isSuper && selected.size > 0 && (
                <button className="btn btn-danger btn-sm" onClick={() => remove([...selected])}>
                  🗑 Удалить выбранные ({selected.size})
                </button>
              )}
            </div>
            {data.results.length === 0 ? (
              <p className="muted small">За этот период результатов нет</p>
            ) : (
              <div className="table-wrap mt">
                <table className="table">
                  <thead>
                    <tr>
                      {isSuper && (
                        <th>
                          <input
                            type="checkbox"
                            aria-label="Выбрать все"
                            checked={data.results.slice(0, shown).every((r: any) => selected.has(r.id))}
                            onChange={(e) => setSelected(e.target.checked ? new Set(data.results.slice(0, shown).map((r: any) => r.id)) : new Set())}
                          />
                        </th>
                      )}
                      <th>Сотрудник</th>
                      <th>Уровень</th>
                      <th>Результат</th>
                      <th>Дата</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.slice(0, shown).map((r: any) => (
                      <tr key={r.id}>
                        {isSuper && (
                          <td>
                            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label="Выбрать" />
                          </td>
                        )}
                        <td>{r.name}</td>
                        <td>{levelInfo(r.level).label}</td>
                        <td style={{ fontWeight: 900 }}>{r.candies} 🍬</td>
                        <td className="muted">{new Date(r.finishedAt).toLocaleString("ru-RU")}</td>
                        <td>
                          <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                            <a href={`/result/${r.id}`}>разбор</a>
                            {isSuper && (
                              <button className="btn btn-ghost btn-sm" title="Удалить результат" onClick={() => remove([r.id])}>
                                🗑
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.results.length > shown && (
              <button className="btn btn-ghost btn-sm mt" onClick={() => setShown(shown + 50)}>
                Показать ещё ({data.results.length - shown})
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
