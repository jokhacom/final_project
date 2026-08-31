"use client";

import { useEffect, useState } from "react";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/analytics").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div style={{ padding: 24 }}>Загрузка...</div>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Аналитика команды</h1>
      <p>Средний результат команды: <strong>{data.avgTeamCandy} 🍬</strong></p>

      <h2 style={{ fontSize: 16, marginTop: 20 }}>По уровням</h2>
      {Object.entries(data.byLevel).map(([level, stats]: any) => (
        <div key={level}>{level}: {stats.count} тестов, средний результат {Math.round(stats.avg)} 🍬</div>
      ))}

      <h2 style={{ fontSize: 16, marginTop: 20 }}>Самые сложные темы (частые ошибки)</h2>
      <ol>
        {data.hardestTopics.map((t: any, i: number) => (
          <li key={i} style={{ fontSize: 13 }}>{t.topic} — {t.count} ошибок</li>
        ))}
      </ol>

      <h2 style={{ fontSize: 16, marginTop: 20 }}>Результаты сотрудников</h2>
      {data.employeeResults.map((e: any, i: number) => (
        <div key={i} style={{ fontSize: 13, borderBottom: "1px solid #eee", padding: "4px 0" }}>
          {e.name} — {e.level} — {e.candies} 🍬
        </div>
      ))}
    </div>
  );
}
