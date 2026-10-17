"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { LEVELS } from "@/lib/levels";

export default function LevelsPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0];

  return (
    <main className="container">
      <h1>Привет{firstName ? `, ${firstName}` : ""}! 👋</h1>
      <p className="muted">Выберите уровень. Каждая попытка — новый набор вопросов: 5 с вариантами ответа и 5 открытых.</p>

      <div className="grid grid-2 mt">
        {LEVELS.map((l) => (
          <Link key={l.id} href={`/test/${l.id}`} className="card level-card" style={{ ["--level" as any]: l.color }}>
            <div style={{ fontSize: 34 }}>{l.icon}</div>
            <div className="level-title">{l.label}</div>
            <div className="muted">{l.description}</div>
            <div className="level-meta">10 вопросов · 15 минут · до 100 🍬</div>
          </Link>
        ))}
      </div>

      <div className="card mt-lg">
        <h3>Как считаются 🍬</h3>
        <ul className="muted small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Старт — 100 🍬. Неверный ответ — −5, орфографическая ошибка — −1, грамматическая — −1.</li>
          <li>Вставлять текст в открытые ответы нельзя — пишите своими словами.</li>
          <li>Больше 90 🍬 — сертификат. 95+ на уровне Professional — достижение «Эксперт ГЦО» 👑.</li>
        </ul>
      </div>
    </main>
  );
}
