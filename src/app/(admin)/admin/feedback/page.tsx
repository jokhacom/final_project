"use client";

import { useEffect, useState } from "react";

type Item = { id: string; type: string; description: string; createdAt: string; user: { name: string; username: string } };

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    fetch("/api/feedback").then((r) => r.json()).then((d) => setItems(d.items ?? []));
  }, []);

  return (
    <div className="stack">
      <h1>Обратная связь</h1>
      {!items ? (
        <div className="card"><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="card muted center">Обращений пока нет</div>
      ) : (
        items.map((i) => (
          <div key={i.id} className="card">
            <div className="row between small">
              <span className="badge">{i.type}</span>
              <span className="muted">
                {i.user.name} (@{i.user.username}) · {new Date(i.createdAt).toLocaleString("ru-RU")}
              </span>
            </div>
            <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{i.description}</p>
          </div>
        ))
      )}
    </div>
  );
}
