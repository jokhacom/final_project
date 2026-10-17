"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { levelInfo } from "@/lib/levels";
import { ChangePassword } from "@/components/ChangePassword";

type Cabinet = {
  user: { name: string; username: string };
  stats: { testsDone: number; avgCandy: number; bestCandy: number; place: number | null };
  attempts: { id: string; level: string; candies: number; startedAt: string }[];
  achievements: { id: string; label: string; icon: string; description: string; earnedAt: string | null }[];
  weakTopics: { topic: string; count: number }[];
};

export default function MyCabinetPage() {
  const [data, setData] = useState<Cabinet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Не удалось загрузить кабинет");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <main className="container"><div className="alert alert-error">{error}</div></main>;
  if (!data) return <main className="container"><div className="card center" style={{ padding: 40 }}><div className="spinner" /></div></main>;

  const stats = [
    { label: "Пройдено тестов", value: data.stats.testsDone },
    { label: "Средний результат", value: `${data.stats.avgCandy} 🍬` },
    { label: "Лучший результат", value: `${data.stats.bestCandy} 🍬` },
    { label: "Место в рейтинге", value: data.stats.place ? `#${data.stats.place}` : "—" },
  ];

  return (
    <main className="container">
      <h1>Личный кабинет</h1>
      <p className="muted">
        {data.user.name} · @{data.user.username}
      </p>
      <ChangePassword />

      <div className="grid grid-4 mt">
        {stats.map((s) => (
          <div key={s.label} className="card center">
            <div style={{ fontSize: 26, fontWeight: 900 }}>{s.value}</div>
            <div className="muted small">{s.label}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-lg">Достижения</h2>
      <div className="grid grid-2">
        {data.achievements.map((a) => (
          <div key={a.id} className={`achievement ${a.earnedAt ? "" : "locked"}`}>
            <span className="icon">{a.icon}</span>
            <div>
              <div style={{ fontWeight: 800 }}>{a.label}</div>
              <div className="muted small">
                {a.earnedAt ? `Получено ${new Date(a.earnedAt).toLocaleDateString("ru-RU")}` : a.description}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-2 mt-lg">
        <div className="card">
          <h2>Слабые темы</h2>
          {data.weakTopics.length === 0 ? (
            <p className="muted small">Слабых тем пока не выявлено 💪</p>
          ) : (
            <>
              <p className="muted small">Темы, в которых чаще всего были ошибки, — их стоит повторить:</p>
              <div className="stack" style={{ gap: 8 }}>
                {data.weakTopics.map((w) => (
                  <div key={w.topic} className="row between small">
                    <span>{w.topic}</span>
                    <span className="badge">{w.count} ош.</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h2>История тестов</h2>
          {data.attempts.length === 0 ? (
            <p className="muted small">
              Вы ещё не проходили тесты. <Link href="/levels">Начать →</Link>
            </p>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {data.attempts.map((a) => {
                const l = levelInfo(a.level);
                return (
                  <Link key={a.id} href={`/result/${a.id}`} className="row between small" style={{ textDecoration: "none", color: "inherit", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ color: l.color, fontWeight: 800 }}>
                      {l.icon} {l.label}
                    </span>
                    <span style={{ fontWeight: 900 }}>{a.candies} 🍬</span>
                    <span className="muted">{new Date(a.startedAt).toLocaleDateString("ru-RU")}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
