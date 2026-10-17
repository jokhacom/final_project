"use client";

import { useEffect, useState } from "react";

type Row = { place: number; name: string; candies: number; avg: number; tests: number; isMe: boolean };

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setRows([]));
  }, []);

  return (
    <main className="container narrow">
      <div className="center">
        <div style={{ fontSize: 64 }}>🏆</div>
        <h1>Таблица лидеров</h1>
        <p className="muted">По лучшему результату за все тесты</p>
      </div>

      <div className="card mt">
        {!rows ? (
          <div className="spinner" />
        ) : rows.length === 0 ? (
          <p className="center muted">Пока никто не прошёл тест — станьте первым!</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Сотрудник</th>
                  <th>Лучший</th>
                  <th>Средний</th>
                  <th>Тестов</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.place} className={r.isMe ? "me" : ""}>
                    <td style={{ fontWeight: 900, fontSize: 18 }}>{MEDALS[r.place - 1] ?? r.place}</td>
                    <td style={{ fontWeight: 700 }}>
                      {r.name}
                      {r.isMe && <span className="muted small"> (вы)</span>}
                    </td>
                    <td style={{ fontWeight: 900 }}>{r.candies} 🍬</td>
                    <td>{r.avg}</td>
                    <td>{r.tests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
