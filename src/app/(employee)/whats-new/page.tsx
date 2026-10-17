"use client";

import { useEffect, useState } from "react";

type Item = { id: string; title: string; body: string; createdAt: string };

export default function WhatsNewPage() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    fetch("/api/changelog")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <main className="container narrow">
      <h1>✨ Что нового</h1>
      <p className="muted">Обновления тренажёра и новые материалы</p>
      <div className="stack mt">
        {!items ? (
          <div className="card"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="card muted center">Пока обновлений нет</div>
        ) : (
          items.map((i) => (
            <div key={i.id} className="card">
              <div className="muted small">{new Date(i.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</div>
              <h2 style={{ marginTop: 4 }}>{i.title}</h2>
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{i.body}</p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
