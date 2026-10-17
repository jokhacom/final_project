"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// Вход только по логину и паролю; регистрация сотрудника — на этой же странице.
export default function AuthPage() {
  const { status } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/levels");
  }, [status, router]);

  async function login() {
    const res = await signIn("credentials", { username: username.trim(), password, redirect: false });
    if (res?.error) throw new Error("Неверный логин или пароль");
    router.push("/levels");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, username, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Не удалось зарегистрироваться");
      }
      await login();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  const canSubmit = username.trim() && password && (mode === "login" || name.trim());

  return (
    <main className="container" style={{ maxWidth: 440, paddingTop: 48 }}>
      <div className="center" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 64 }}>🍭</div>
        <h1>Тренажер знаний ГЦО</h1>
        <p className="muted">Проверьте знание Редполитики и Tone of Voice, соберите 100 🍬 и получите сертификат</p>
      </div>

      <form className="card stack" onSubmit={handleSubmit}>
        <div className="tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Вход
          </button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Регистрация
          </button>
        </div>

        {mode === "register" && (
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя и фамилия" autoComplete="name" />
        )}
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Логин" autoComplete="username" />
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "register" ? "Пароль (не короче 6 символов)" : "Пароль"}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
        />

        {error && <div className="alert alert-error">{error}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={loading || !canSubmit}>
          {loading ? "Подождите..." : mode === "login" ? "Войти →" : "Зарегистрироваться →"}
        </button>
      </form>
    </main>
  );
}
