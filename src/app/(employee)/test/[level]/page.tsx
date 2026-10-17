"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedTextarea } from "@/components/ProtectedTextarea";
import { isLevel, levelInfo } from "@/lib/levels";

type Question = { id: string; type: string; text: string; options: string[] | null; image: string | null };

const CHOICE = ["MULTIPLE_CHOICE", "BEST_RESPONSE"];
const TYPE_HINT: Record<string, string> = {
  MULTIPLE_CHOICE: "Выберите один правильный ответ",
  BEST_RESPONSE: "Выберите лучший ответ клиенту",
  OPEN: "Ответьте своими словами",
  FIND_ERROR: "Найдите ошибку в сообщении и объясните её",
  FIX_MESSAGE: "Перепишите сообщение правильно",
};

export default function TestPage() {
  const { level } = useParams<{ level: string }>();
  const router = useRouter();
  const info = levelInfo(level);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"loading" | "question" | "checking" | "finishing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const finishing = useRef(false);

  // Старт попытки
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!isLevel(level)) {
      setError("Такого уровня нет");
      setPhase("error");
      return;
    }
    (async () => {
      const res = await fetch("/api/attempts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось начать тест");
        setPhase("error");
        return;
      }
      setAttemptId(data.attemptId);
      setQuestions(data.questions);
      setDeadline(Date.now() + data.durationSec * 1000);
      setPhase("question");
    })();
  }, [level]);

  const finish = useCallback(async () => {
    if (!attemptId || finishing.current) return;
    finishing.current = true;
    setPhase("finishing");
    const res = await fetch("/api/attempts/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      finishing.current = false;
      setError(data.error ?? "Не удалось завершить тест");
      setPhase("error");
      return;
    }
    try {
      sessionStorage.setItem(`achievements:${attemptId}`, JSON.stringify(data.newAchievements ?? []));
    } catch {}
    router.replace(`/result/${attemptId}`);
  }, [attemptId, router]);

  // Таймер; когда время вышло — тест завершается, неотвеченные вопросы считаются неверными.
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  const left = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  useEffect(() => {
    if (deadline && left === 0 && phase === "question") finish();
  }, [left, deadline, phase, finish]);

  // Предупреждение при попытке закрыть вкладку во время теста.
  useEffect(() => {
    if (phase !== "question" && phase !== "checking") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  const q = questions[index];
  const isChoice = q ? CHOICE.includes(q.type) : false;

  async function submit() {
    if (!q || !attemptId || busy) return;
    setBusy(true);
    if (!isChoice) setPhase("checking");
    const res = await fetch(isChoice ? "/api/attempts/submit-mc" : "/api/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isChoice ? { attemptId, questionId: q.id, selectedIndex: selected } : { attemptId, questionId: q.id, answerText: text }
      ),
    });
    const data = await res.json().catch(() => ({}));
    // 409 — ответ уже принят ранее (например, двойной клик) или время вышло: просто идём дальше.
    if (!res.ok && res.status !== 409) {
      setError(data.error ?? "Не удалось отправить ответ");
      setPhase("question");
      setBusy(false);
      return;
    }
    setError(null);
    setSelected(null);
    setText("");
    if (index + 1 >= questions.length) {
      await finish();
    } else {
      setIndex(index + 1);
      setPhase("question");
    }
    setBusy(false);
  }

  if (phase === "error") {
    return (
      <main className="container narrow">
        <div className="card center stack">
          <div style={{ fontSize: 48 }}>😕</div>
          <p>{error}</p>
          <Link href="/levels" className="btn btn-primary">
            К уровням
          </Link>
        </div>
      </main>
    );
  }

  if (phase === "loading" || phase === "finishing") {
    return (
      <main className="container narrow">
        <div className="card center stack" style={{ padding: 40 }}>
          <div className="spinner" />
          <p>{phase === "loading" ? "Готовим вопросы..." : "Подводим итоги..."}</p>
        </div>
      </main>
    );
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <main className="container narrow">
      <div className="row between">
        <span className="badge" style={{ color: info.color }}>
          {info.icon} {info.label}
        </span>
        <span className={`timer ${left <= 10 ? "danger" : ""}`}>
          ⏱ {mm}:{ss}
        </span>
      </div>

      <div className="progress mt">
        {questions.map((_, i) => (
          <div key={i} className={`seg ${i < index ? "done" : i === index ? "current" : ""}`} />
        ))}
      </div>

      {phase === "checking" ? (
        <div className="card center stack mt" style={{ padding: 40 }}>
          <div className="spinner" />
          <h2>Мы проверяем ваш ответ...</h2>
          <p className="muted">Это займёт несколько секунд</p>
        </div>
      ) : (
        q && (
          <div className="card stack mt">
            <div className="muted small">
              Вопрос {index + 1} из {questions.length} · {TYPE_HINT[q.type] ?? ""}
            </div>
            <div className="question-text">{q.text}</div>
            {q.image && (
              <a href={q.image} target="_blank" rel="noreferrer" title="Открыть крупно">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.image} alt="Скриншот к вопросу" className="question-image" />
              </a>
            )}

            {isChoice ? (
              <div className="stack">
                {(q.options ?? []).map((opt, i) => (
                  <button key={i} className={`option ${selected === i ? "selected" : ""}`} onClick={() => setSelected(i)}>
                    <span className="letter">{String.fromCharCode(1040 + i)}</span>
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            ) : (
              <ProtectedTextarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Напишите ответ своими словами..."
                rows={6}
                maxLength={3000}
              />
            )}

            {error && <div className="alert alert-error">{error}</div>}

            <button
              className="btn btn-primary btn-block"
              onClick={submit}
              disabled={busy || (isChoice ? selected === null : !text.trim())}
            >
              {index + 1 === questions.length ? "Завершить тест ✓" : "Ответить →"}
            </button>
          </div>
        )
      )}
    </main>
  );
}
