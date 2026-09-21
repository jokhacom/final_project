"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function MyCabinetPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = (session?.user as any)?.id;
    if (!userId) return;

    fetch(`/api/users/${userId}/cabinet`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(String(e)));
  }, [session]);

  if (status === "loading") {
    return <div style={{ padding: 24, textAlign: "center" }}>Загрузка...</div>;
  }

  if (!session) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p>Вы не авторизованы.</p>
        <Link href="/">Вернуться на главную</Link>
      </div>
    );
  }

  if (error) {
    return <div style={{ padding: 24, textAlign: "center", color: "crimson" }}>Ошибка: {error}</div>;
  }

  if (!data) {
    return <div style={{ padding: 24, textAlign: "center" }}>Загрузка данных кабинета...</div>;
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Личный кабинет — {data.user.name}</h1>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Достижения</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {data.achievements.length === 0 && <span style={{ color: "#999", fontSize: 13 }}>Пока нет достижений</span>}
        {data.achievements.map((a: any) => (
          <div key={a.achievementId} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px", fontSize: 13 }}>
            {a.achievementId}
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>История тестов</h2>
      {data.attempts.length === 0 && <div style={{ color: "#999", fontSize: 13 }}>Пока нет пройденных тестов</div>}
      {data.attempts.map((a: any) => (
        <div key={a.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0", display: "flex", justifyContent: "space-between" }}>
          <span>{a.level}</span>
          <span>{a.candies} 🍬</span>
          <span style={{ color: "#888", fontSize: 12 }}>{new Date(a.startedAt).toLocaleDateString("ru-RU")}</span>
        </div>
      ))}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Слабые темы (рекомендации ИИ)</h2>
      {data.weakTopics.length === 0 && <div style={{ color: "#999", fontSize: 13 }}>Слабых тем пока не выявлено</div>}
      <ul>
        {data.weakTopics.map((w: any) => (
          <li key={w.id} style={{ fontSize: 13, marginBottom: 4 }}>{w.topic}</li>
        ))}
      </ul>

      <Link href="/levels" style={{ display: "inline-block", marginTop: 16, color: "#7C4DFF" }}>
        ← К уровням
      </Link>
    </div>
  );
}
