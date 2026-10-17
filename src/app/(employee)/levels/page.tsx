"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LEVELS } from "@/lib/levels";
import { formatPenalty } from "@/lib/scoring";

// «1 вопрос», «3 вопроса», «10 вопросов»
function plural(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "вопрос";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "вопроса";
  return "вопросов";
}

export default function LevelsPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0];
  const [ready, setReady] = useState<Record<string, boolean> | null>(null);
  const [inTest, setInTest] = useState<Record<string, number>>({});
  const [left, setLeft] = useState<Record<string, number | null>>({});
  const [minutes, setMinutes] = useState(15);
  const [count, setCount] = useState(10);

  useEffect(() => {
    fetch("/api/levels")
      .then((r) => r.json())
      .then((d) => {
        setReady(Object.fromEntries((d.levels ?? []).map((l: { id: string; ready: boolean }) => [l.id, l.ready])));
        setInTest(Object.fromEntries((d.levels ?? []).map((l: { id: string; inTest: number }) => [l.id, l.inTest])));
        setLeft(Object.fromEntries((d.levels ?? []).map((l: { id: string; attemptsLeft: number | null }) => [l.id, l.attemptsLeft])));
        if (d.minutes) setMinutes(d.minutes);
        if (d.count) setCount(d.count);
      })
      .catch(() => setReady(null));
  }, []);

  return (
    <main className="container">
      <h1>Привет{firstName ? `, ${firstName}` : ""}! 👋</h1>
      <p className="muted">
        Выберите уровень. Каждая попытка — новый случайный набор вопросов: с вариантами ответа и открытые.
      </p>

      <div className="grid grid-2 mt">
        {LEVELS.map((l) => {
          const content = (
            <>
              <div style={{ fontSize: 34 }}>{l.icon}</div>
              <div className="level-title">{l.label}</div>
              <div className="muted">{l.description}</div>
              <div className="level-meta">
                {inTest[l.id] || count} {plural(inTest[l.id] || count)} · {minutes} мин · до 100 🍬
              </div>
              {left[l.id] != null && left[l.id]! > 0 && <div className="level-meta">Осталось попыток: {left[l.id]}</div>}
            </>
          );
          // Попытки по уровню закончились (лимит задаёт администратор).
          if (left[l.id] === 0) {
            return (
              <div key={l.id} className="card level-card disabled" style={{ ["--level" as any]: l.color }}>
                {content}
                <span className="badge" style={{ alignSelf: "flex-start" }}>
                  🔒 Попытки закончились
                </span>
              </div>
            );
          }
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
            Старт — 100 🍬. За неверный ответ снимается доля от 50 🍬 (в тесте из {count} вопросов — −{formatPenalty(count)}), орфографическая
            ошибка — −1, грамматическая — −1.
          </li>
          <li>Вставлять текст в открытые ответы нельзя — пишите своими словами.</li>
          <li>Больше 90 🍬 — сертификат. 95+ на уровне Professional — достижение «Эксперт ГЦО» 👑.</li>
        </ul>
      </div>
    </main>
  );
}
