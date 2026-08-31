"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

// Раздел 1 запроса: вход только по логину и паролю. Переключатель между
// формой входа и формой регистрации на одной странице.
export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Неверный логин или пароль");
      return;
    }
    router.push("/levels");
  }

  async function handleRegister() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    // Сразу входим после регистрации
    await signIn("credentials", { username, password, redirect: false });
    router.push("/levels");
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 24, fontFamily: "sans-serif", textAlign: "center" }}>
      <div style={{ fontSize: 48 }}>🍭</div>
      <h1>Тренажер знаний ГЦО</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, justifyContent: "center" }}>
        <button onClick={() => setMode("login")} style={{ fontWeight: mode === "login" ? 700 : 400, padding: "6px 12px" }}>
          Вход
        </button>
        <button onClick={() => setMode("register")} style={{ fontWeight: mode === "register" ? 700 : 400, padding: "6px 12px" }}>
          Регистрация
        </button>
      </div>

      {mode === "register" && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ваше имя"
          style={{ width: "100%", padding: 12, marginBottom: 10, boxSizing: "border-box" }}
        />
      )}
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Логин"
        style={{ width: "100%", padding: 12, marginBottom: 10, boxSizing: "border-box" }}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Пароль"
        style={{ width: "100%", padding: 12, marginBottom: 16, boxSizing: "border-box" }}
      />

      {error && <div style={{ color: "crimson", marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <button
        onClick={mode === "login" ? handleLogin : handleRegister}
        disabled={loading || !username.trim() || !password || (mode === "register" && !name.trim())}
        style={{ width: "100%", padding: 12, background: "#7C4DFF", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
      >
        {loading ? "..." : mode === "login" ? "Войти →" : "Зарегистрироваться →"}
      </button>
    </div>
  );
}
