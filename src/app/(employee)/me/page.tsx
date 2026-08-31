"use client";

import { useEffect, useState } from "react";

// Раздел 17: личный кабинет сотрудника — история тестов, результаты, ошибки,
// рекомендации ИИ, достижения, прогресс. userId сейчас берётся из localStorage
// (записывается туда на экране входа по имени, /api/users/start).
export default function MyCabinetPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const userId = localStorage.getItem("gco_user_id");
    if (!userId) return;
    fetch(`/api/users/${userId}/cabinet`)
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div style={{ padding: 24 }}>Загрузка...</div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Личный кабинет — {data.user.name}</h1>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Достижения</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {data.achievements.map((a: any) => (
          <div key={a.achievementId} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px", fontSize: 13 }}>
            {a.achievementId}
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>История тестов</h2>
      {data.attempts.map((a: any) => (
        <div key={a.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0", display: "flex", justifyContent: "space-between" }}>
          <span>{a.level}</span>
          <span>{a.candies} 🍬</span>
          <span style={{ color: "#888", fontSize: 12 }}>{new Date(a.startedAt).toLocaleDateString("ru-RU")}</span>
        </div>
      ))}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Слабые темы (рекомендации ИИ)</h2>
      <ul>
        {data.weakTopics.map((w: any) => (
          <li key={w.id} style={{ fontSize: 13, marginBottom: 4 }}>{w.topic}</li>
        ))}
      </ul>
    </div>
  );
}
