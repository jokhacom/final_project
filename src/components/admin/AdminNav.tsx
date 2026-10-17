"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/materials", label: "Материалы" },
  { href: "/admin/questions", label: "Вопросы" },
  { href: "/admin/analytics", label: "Аналитика" },
  { href: "/admin/feedback", label: "Обратная связь" },
  { href: "/admin/changelog", label: "Что нового" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="tabs" style={{ marginBottom: 20, flexWrap: "wrap" }}>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{
            flex: 1,
            textAlign: "center",
            padding: 10,
            borderRadius: 10,
            fontWeight: 800,
            textDecoration: "none",
            whiteSpace: "nowrap",
            ...(pathname === l.href ? { background: "var(--gradient)", color: "#fff" } : { color: "var(--muted)" }),
          }}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
