"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LEVELS } from "@/lib/levels";
import { formatPenalty } from "@/lib/scoring";

export default function LevelsPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0];
  const [ready, setReady] = useState<Record<string, boolean> | null>(null);
  const [minutes, setMinutes] = useState(15);
  const [count, setCount] = useState(10);

  useEffect(() => {
    fetch("/api/levels")
      .then((r) => r.json())
      .then((d) => {
        setReady(Object.fromEntries((d.levels ?? []).map((l: { id: string; ready: boolean }) => [l.id, l.ready])));
        if (d.minutes) setMinutes(d.minutes);
        if (d.count) setCount(d.count);
      })
      .catch(() => setReady(null));
  }, []);

  return (
    <main className="container">
      <h1>Привет{firstName ? `, ${firstName}` : ""}! 👋</h1>
      <p className="muted">
        Выберите уровень. Каждая попытка — новый набор вопросов: {Math.ceil(count / 2)} с вариантами ответа и {Math.floor(count / 2)} открытых.
      </p>

      <div className="grid grid-2 mt">
        {LEVELS.map((l) => {
          const content = (
            <>
              <div style={{ fontSize: 34 }}>{l.icon}</div>
              <div className="level-title">{l.label}</div>
              <div className="muted">{l.description}</div>
              <div className="level-meta">{count} вопросов · {minutes} мин · до 100 🍬</div>
            </>
          );
          // Пока вопросов для уровня недостаточно — карточка неактивна.
          if (ready && ready[l.id] === false) {
            return (
              <div key={l.id} className="card level-card disabled" style={{ ["--level" as any]: l.color }}>
                {content}
                <span className="badge" style={{ alignSelf: "flex-start" }}>
                  ⏳ Скоро — вопросы готовятся
                </span>
              </div>
            );
          }
          return (
            <Link key={l.id} href={`/test/${l.id}`} className="card level-card" style={{ ["--level" as any]: l.color }}>
              {content}
            </Link>
          );
        })}
      </div>

      <div className="card mt-lg">
        <h3>Как считаются 🍬</h3>
        <ul className="muted small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>
            Старт — 100 🍬. Неверный ответ — −{formatPenalty(count)}, орфографическая ошибка — −1, грамматическая — −1.
          </li>
          <li>Вставлять текст в открытые ответы нельзя — пишите своими словами.</li>
          <li>Больше 90 🍬 — сертификат. 95+ на уровне Professional — достижение «Эксперт ГЦО» 👑.</li>
        </ul>
      </div>
    </main>
  );
}
