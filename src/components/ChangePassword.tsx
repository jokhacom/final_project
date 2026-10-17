"use client";

import { useState } from "react";

export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Не удалось сменить пароль" });
    setMsg({ ok: true, text: "Пароль изменён" });
    setCurrent("");
    setNext("");
  }

  if (!open) {
    return (
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        🔑 Сменить пароль
      </button>
    );
  }

  return (
    <form className="card stack" onSubmit={save} style={{ maxWidth: 420 }}>
      <h3 style={{ margin: 0 }}>Смена пароля</h3>
      <input className="input" type="password" placeholder="Текущий пароль" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      <input className="input" type="password" placeholder="Новый пароль (не короче 6 символов)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      {msg && <div className={`alert ${msg.ok ? "alert-success" : "alert-error"}`}>{msg.text}</div>}
      <div className="row">
        <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !current || next.length < 6}>
          {saving ? "Сохраняем..." : "Сохранить"}
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setOpen(false); setMsg(null); }}>
          Закрыть
        </button>
      </div>
    </form>
  );
}
