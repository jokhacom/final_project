"use client";

import { useState } from "react";
import { USERNAME_RE } from "@/lib/usernameRule";

// Пароль из понятных символов (без 0/O, 1/l/I), чтобы сотрудник не перепутал при вводе.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generatePassword(len = 10) {
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// Создание пользователя суперадминистратором: имя, логин и пароль придумывает он сам и передаёт сотруднику.
export function AddUserForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"EMPLOYEE" | "ADMIN">("EMPLOYEE");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; username: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const badLogin = username.trim() !== "" && !USERNAME_RE.test(username.trim());
  const site = typeof window !== "undefined" ? `${window.location.origin}/login` : "";
  const loginText = created ? `Сайт: ${site}\nЛогин: ${created.username}\nПароль: ${created.password}` : "";

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username: username.trim(), password, role }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(d.error ?? "Не удалось создать пользователя");
    setCreated({ name: name.trim(), username: username.trim(), password });
    setName("");
    setUsername("");
    setPassword("");
    setRole("EMPLOYEE");
    onCreated();
  }

  if (!open && !created)
    return (
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
        + Добавить пользователя
      </button>
    );

  if (created)
    return (
      <div className="card stack" style={{ border: "2px solid var(--success)" }}>
        <strong>✅ Пользователь «{created.name}» создан</strong>
        <div className="muted small">Отправьте сотруднику эти данные — он войдёт на сайт с ними. Пароль потом можно сменить в его кабинете.</div>
        <pre style={{ margin: 0, padding: 14, borderRadius: 12, background: "var(--surface-strong)", whiteSpace: "pre-wrap", fontSize: 18, fontWeight: 700 }}>{loginText}</pre>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={async () => {
              await navigator.clipboard.writeText(loginText).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "✅ Скопировано" : "📋 Скопировать данные для входа"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setCreated(null); setOpen(true); }}>
            + Ещё пользователь
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setCreated(null); setOpen(false); }}>
            Закрыть
          </button>
        </div>
      </div>
    );

  return (
    <div className="card stack">
      <strong>➕ Новый пользователь</strong>
      <input className="input" placeholder="Имя и фамилия, например Нигора Каримова" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input" placeholder="Логин латиницей, например nigora.k" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
      {badLogin && (
        <div className="small" style={{ color: "var(--danger)", marginTop: -4 }}>
          {username.includes("@") ? "Логин — это не почта: без @. " : ""}Только латинские буквы, цифры, точка, дефис или _ (3–32 символа).
        </div>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Пароль (не короче 6 символов)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button type="button" className="btn btn-ghost btn-sm" style={{ flex: "none" }} onClick={() => setPassword(generatePassword())}>
          🎲 Придумать
        </button>
      </div>
      <label className="row small" style={{ gap: 8 }}>
        Роль:
        <select className="select" style={{ width: "auto", padding: "6px 10px" }} value={role} onChange={(e) => setRole(e.target.value as "EMPLOYEE" | "ADMIN")}>
          <option value="EMPLOYEE">Сотрудник</option>
          <option value="ADMIN">Администратор</option>
        </select>
      </label>
      {error && <div className="alert alert-error" style={{ margin: 0 }}>{error}</div>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={saving || !name.trim() || !username.trim() || password.length < 6 || badLogin} onClick={submit}>
          {saving ? "Создаю…" : "Создать"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setError(null); }}>
          Отмена
        </button>
      </div>
    </div>
  );
}
