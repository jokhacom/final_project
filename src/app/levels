"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function LevelsPage() {
  const { data: session, status } = useSession();

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

  return (
    <div style={{ maxWidth: 480, margin: "60px auto", padding: 24, fontFamily: "sans-serif", textAlign: "center" }}>
      <div style={{ fontSize: 48 }}>✅</div>
      <h1>Вход выполнен успешно!</h1>
      <p style={{ color: "#666" }}>
        Добро пожаловать, <strong>{session.user?.name}</strong>.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
        <Link href="/me" style={{ padding: 10, background: "#7C4DFF", color: "white", borderRadius: 8, textDecoration: "none" }}>
          Личный кабинет
        </Link>
        <button onClick={() => signOut({ callbackUrl: "/" })} style={{ padding: 10, background: "none", border: "1px solid #ccc", borderRadius: 8, cursor: "pointer" }}>
          Выйти
        </button>
      </div>
    </div>
  );
}
