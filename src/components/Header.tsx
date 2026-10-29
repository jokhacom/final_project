"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/levels", label: "Уровни" },
  { href: "/learn", label: "Обучение" },
  { href: "/me", label: "Кабинет" },
  { href: "/leaderboard", label: "Рейтинг" },
  { href: "/whats-new", label: "Что нового" },
];

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = (session?.user as any)?.role;
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN";
  // Во время теста навигацию не показываем, чтобы случайно не уйти со страницы.
  const inTest = pathname?.startsWith("/test/");
  // «Помощник ответов» в меню — только у тех, кому он доступен (премиум и администраторы).
  const [assistant, setAssistant] = useState(false);
  const userId = (session?.user as any)?.id;
  useEffect(() => {
    if (!userId) return setAssistant(false);
    fetch("/api/assistant").then((r) => r.json()).then((d) => setAssistant(!!d.allowed)).catch(() => {});
  }, [userId]);

  return (
    <header className="header">
      <div className="header-inner">
        <Link href={session ? "/levels" : "/"} className="logo">
          🍬 Тренажер знаний ГЦО
        </Link>
        {session && !inTest && (
          <nav className="nav">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
                {l.label}
              </Link>
            ))}
            {assistant && (
              <Link href="/assistant" className={pathname === "/assistant" ? "active" : ""}>
                ⭐ Помощник
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin" className={pathname?.startsWith("/admin") ? "active" : ""}>
                Админ
              </Link>
            )}
          </nav>
        )}
        <div className="header-actions" style={{ marginLeft: "auto" }}>
          <ThemeToggle />
          {session && !inTest && (
            <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>
              Выйти
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
