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

// Ответ на вопрос в браузере: номер варианта или текст.
type Draft = { selected: number | null; text: string };
const emptyDraft: Draft = { selected: null, text: "" };
const isAnswered = (q: Question, d: Draft | undefined) => !!d && (CHOICE.includes(q.type) ? d.selected !== null : !!d.text.trim());

export default function TestPage() {
  const { level } = useParams<{ level: string }>();
  const router = useRouter();
  const info = levelInfo(level);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const saved = useRef<Record<string, string>>({}); // что уже сохранено на сервере (rawAnswer)
  const [phase, setPhase] = useState<"loading" | "question" | "finishing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [confirmFinish, setConfirmFinish] = useState<number[] | null>(null); // номера неотвеченных вопросов
  const started = useRef(false);
  const finishing = useRef(false);

  // Старт или продолжение попытки: если тест этого уровня уже начат и время не вышло,
  // сервер вернёт ту же попытку с сохранёнными ответами и оставшимся временем.
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
      const qs: Question[] = data.questions;
      const restored: Record<string, Draft> = {};
      for (const q of qs) {
        const raw = data.answers?.[q.id];
        if (raw === undefined) continue;
        saved.current[q.id] = raw;
        restored[q.id] = CHOICE.includes(q.type) ? { selected: raw === "" ? null : Number(raw), text: "" } : { selected: null, text: raw };
      }
      setAttemptId(data.attemptId);
      setQuestions(qs);
      setDrafts(restored);
      // Продолжаем с первого вопроса без ответа.
      const firstOpen = qs.findIndex((q) => !isAnswered(q, restored[q.id]));
      setIndex(firstOpen === -1 ? qs.length - 1 : firstOpen);
      setDeadline(Date.now() + data.secondsLeft * 1000);
      setPhase("question");
    })();
  }, [level]);

  // Сохранить ответ на вопрос, если он изменился. Ошибку показываем, но сотрудника не держим.
  const saveDraft = useCallback(
    async (q: Question | undefined, keepalive = false) => {
      if (!q || !attemptId) return true;
      const d = drafts[q.id] ?? emptyDraft;
      const choice = CHOICE.includes(q.type);
      const raw = choice ? (d.selected === null ? "" : String(d.selected)) : d.text;
      if (!isAnswered(q, d) || saved.current[q.id] === raw) return true;
      const res = await fetch(choice ? "/api/attempts/submit-mc" : "/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(choice ? { attemptId, questionId: q.id, selectedIndex: d.selected } : { attemptId, questionId: q.id, answerText: d.text }),
        keepalive,
      }).catch(() => null);
      if (res?.ok) {
        saved.current[q.id] = raw;
        setError(null);
        return true;
      }
      const data = await res?.json().catch(() => ({}));
      setError(data?.error ?? "Не удалось сохранить ответ — проверьте интернет");
      return false;
    },
    [attemptId, drafts]
  );

  const finish = useCallback(async () => {
    if (!attemptId || finishing.current) return;
    finishing.current = true;
    setConfirmFinish(null);
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

  // Таймер идёт по времени сервера: и пока страница закрыта. Когда время вышло — тест завершается,
  // неотвеченные вопросы считаются неверными.
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  const left = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  useEffect(() => {
    if (deadline && left === 0 && phase === "question") saveDraft(questions[index]).finally(finish);
  }, [left, deadline, phase, finish, saveDraft, questions, index]);

  const q = questions[index];
  const isChoice = q ? CHOICE.includes(q.type) : false;
  const draft = (q && drafts[q.id]) || emptyDraft;
  const setDraft = (patch: Partial<Draft>) => q && setDrafts((all) => ({ ...all, [q.id]: { ...(all[q.id] ?? emptyDraft), ...patch } }));

  // Вариант сохраняем сразу; текст — через 1,5 секунды после последнего ввода и при уходе со страницы.
  useEffect(() => {
    if (!q || phase !== "question") return;
    const t = setTimeout(() => saveDraft(q), isChoice ? 0 : 1500);
    return () => clearTimeout(t);
  }, [draft, q, isChoice, phase, saveDraft]);
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && saveDraft(q, true);
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [q, saveDraft]);

  async function goTo(i: number) {
    if (i < 0 || i >= questions.length || i === index) return;
    await saveDraft(q);
    setIndex(i);
  }

  async function tryFinish() {
    await saveDraft(q);
    const missing = questions.map((qq, i) => (isAnswered(qq, drafts[qq.id]) ? -1 : i + 1)).filter((n) => n > 0);
    if (missing.length) setConfirmFinish(missing);
    else finish();
  }

  if (phase === "error") {    return (
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
          {phase === "loading" ? (
            <p>Готовим вопросы...</p>
          ) : (
            <>
              <h2>Мы проверяем ваши ответы...</h2>
              <p className="muted">Это займёт несколько секунд</p>
            </>
          )}
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

      {/* Сегменты прогресса — тоже навигация: зелёный — есть ответ, розовый — текущий вопрос. */}
      <div className="progress mt">
        {questions.map((qq, i) => (
          <button
            key={qq.id}
            className={`seg seg-btn ${i === index ? "current" : isAnswered(qq, drafts[qq.id]) ? "done" : ""}`}
            onClick={() => goTo(i)}
            aria-label={`Вопрос ${i + 1}`}
          />
        ))}
      </div>

      {q && (
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
                <button key={i} className={`option ${draft.selected === i ? "selected" : ""}`} onClick={() => setDraft({ selected: i })}>
                  <span className="letter">{String.fromCharCode(1040 + i)}</span>
                  <span>{opt}</span>
                </button>
              ))}
            </div>
          ) : (
            <ProtectedTextarea
              value={draft.text}
              onChange={(e) => setDraft({ text: e.target.value })}
              placeholder="Напишите ответ своими словами..."
              rows={6}
              maxLength={3000}
            />
          )}

          {error && <div className="alert alert-error">{error}</div>}

          <div className="test-nav">
            <button className="btn btn-ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
              ← Назад
            </button>
            {index + 1 < questions.length ? (
              <button className="btn btn-primary" onClick={() => goTo(index + 1)}>
                Вперёд →
              </button>
            ) : (
              <button className="btn btn-primary" onClick={tryFinish}>
                Завершить тест ✓
              </button>
            )}
          </div>
          {index + 1 < questions.length && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "center" }} onClick={tryFinish}>
              Завершить тест досрочно
            </button>
          )}
          <div className="muted small center">Ответы сохраняются сами — можно вернуться к любому вопросу до завершения теста.</div>
        </div>
      )}

      {confirmFinish && (
        <div className="modal-backdrop" onClick={() => setConfirmFinish(null)}>
          <div className="card stack" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0 }}>⚠️ Есть вопросы без ответа</h2>
            <p style={{ margin: 0 }}>
              {confirmFinish.length === 1 ? "Не отвечен вопрос" : "Не отвечены вопросы"} <strong>{confirmFinish.join(", ")}</strong>. Если завершить сейчас, они
              засчитаются как неверные.
            </p>
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                const first = confirmFinish[0] - 1;
                setConfirmFinish(null);
                goTo(first);
              }}
            >
              Вернуться к вопросу {confirmFinish[0]}
            </button>
            <button className="btn btn-ghost btn-block" onClick={finish}>
              Всё равно завершить
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
