"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/levels", label: "Уровни" },
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
