"use client";

import { useEffect, useState } from "react";
import { levelInfo } from "@/lib/levels";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/analytics").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div className="card"><div className="spinner" /></div>;

  const tiles = [
    { label: "Сотрудников", value: data.employees },
    { label: "Пройдено тестов", value: data.testsDone },
    { label: "Средний результат", value: `${data.avgTeamCandy} 🍬` },
  ];

  return (
    <div className="stack">
      <div className="grid grid-4">
        {tiles.map((t) => (
          <div key={t.label} className="card center">
            <div style={{ fontSize: 28, fontWeight: 900 }}>{t.value}</div>
            <div className="muted small">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>По уровням</h2>
        {Object.keys(data.byLevel).length === 0 && <p className="muted small">Данных пока нет</p>}
        <div className="stack" style={{ gap: 10 }}>
          {Object.entries(data.byLevel).map(([level, s]: any) => {
            const l = levelInfo(level);
            return (
              <div key={level}>
                <div className="row between small">
                  <span style={{ fontWeight: 800, color: l.color }}>
                    {l.icon} {l.label}
                  </span>
                  <span className="muted">
                    {s.count} тестов · среднее {s.avg} 🍬
                  </span>
                </div>
                <div className="seg" style={{ marginTop: 6, background: "var(--border)" }}>
                  <div style={{ width: `${s.avg}%`, height: "100%", borderRadius: 99, background: l.color }} />
                </div>
              </div>
            );
          })}
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
            <div key={i} className="row between small" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span>{t.topic}</span>
              <span className="badge">{t.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Последние результаты</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Уровень</th>
                <th>Результат</th>
                <th>Дата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.recentResults.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{levelInfo(r.level).label}</td>
                  <td style={{ fontWeight: 900 }}>{r.candies} 🍬</td>
                  <td className="muted">{new Date(r.finishedAt).toLocaleString("ru-RU")}</td>
                  <td>
                    <a href={`/result/${r.id}`}>разбор</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
