"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LEVELS } from "@/lib/levels";

const STEPS = [
  { title: "Войдите", text: "Зарегистрируйтесь или войдите по логину и паролю." },
  { title: "Пройдите уровни", text: "Новичок → Middle → Professional: вопросы по Редполитике и Tone of Voice." },
  { title: "Сдайте экзамен", text: "Итоговое задание (KPI) — отдельный тест для проверки знаний." },
];

const FEATURES = [
  { icon: "🍬", title: "Конфеты", text: "За тест — до 100 🍬. Ошибки в ответах и орфографии отнимают конфеты." },
  { icon: "🏆", title: "Рейтинг и достижения", text: "Сравните результат с коллегами и соберите награды." },
  { icon: "🎮", title: "Игры", text: "«Можно или нельзя?», «Найди и исправь ошибку» и «Грамотность» — русский и узбекский на скорость." },
  { icon: "📊", title: "Презентации", text: "Учебные материалы можно открыть прямо на сайте." },
];

// Главная страница: что это за тренажер и как он работает. Вход — на /login.
export default function LandingPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/levels");
  }, [status, router]);

  return (
    <main className="container">
      <section className="hero">
        <div style={{ fontSize: 72 }}>🍭</div>
        <h1>Тренажер знаний ГЦО</h1>
        <p className="muted">Учитесь отвечать клиентам правильно — в формате коротких тестов и игр.</p>
        <Link href="/login" className="btn btn-primary">
          Войти →
        </Link>
      </section>

      <h2 className="mt-lg center">Как это работает</h2>
      <div className="grid grid-land mt">
        {STEPS.map((s, i) => (
          <div key={s.title} className="card stack" style={{ gap: 8 }}>
            <div className="step-num">{i + 1}</div>
            <strong>{s.title}</strong>
            <div className="muted small">{s.text}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-lg center">Уровни</h2>
      <div className="grid grid-land mt">
        {LEVELS.map((l) => (
          <div key={l.id} className="card level-card static" style={{ ["--level" as string]: l.color }}>
            <div className="level-title">
              {l.icon} {l.label}
            </div>
            <div className="muted small">{l.description}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-lg center">Что внутри</h2>
      <div className="grid grid-land mt">
        {FEATURES.map((f) => (
          <div key={f.title} className="card stack" style={{ gap: 8 }}>
            <div className="feature-icon">{f.icon}</div>
            <strong>{f.title}</strong>
            <div className="muted small">{f.text}</div>
          </div>
        ))}
      </div>

      <div className="center mt-lg">
        <Link href="/login" className="btn btn-primary">
          Начать →
        </Link>
      </div>
    </main>
  );
}
