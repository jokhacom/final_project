"use client";

import { useEffect, useState } from "react";

type Item = { id: string; title: string; body: string; createdAt: string };

export default function AdminChangelogPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => fetch("/api/changelog").then((r) => r.json()).then((d) => setItems(d.items ?? []));
  useEffect(() => {
    load();
  }, []);

  async function add() {
    setError(null);
    const res = await fetch("/api/changelog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Не удалось сохранить");
      return;
    }
    setTitle("");
    setBody("");
    load();
  }

  return (
    <div className="stack">
      <div className="card stack">
        <h2>Новая запись «Что нового»</h2>
        <input className="input" placeholder="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="textarea" placeholder="Что изменилось" value={body} onChange={(e) => setBody(e.target.value)} />
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn btn-primary" onClick={add} disabled={!title.trim() || !body.trim()}>
          Опубликовать
        </button>
      </div>
      {items.map((i) => (
        <div key={i.id} className="card">
          <div className="muted small">{new Date(i.createdAt).toLocaleDateString("ru-RU")}</div>
          <h3 style={{ marginTop: 4 }}>{i.title}</h3>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{i.body}</p>
        </div>
      ))}
    </div>
  );
}
