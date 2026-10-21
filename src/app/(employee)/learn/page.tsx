"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GAME_TIMER_DEFAULTS, LANGUAGE_ROUND, type GameTimerKind } from "@/lib/gameConstants";
import { isPowerPoint, viewerUrl } from "@/lib/presentations";
import { PdfViewer } from "@/components/PdfViewer";

type Presentation = { id: string; title: string; description: string | null; fileName: string; url: string | null; createdAt: string };

// Яркие обложки карточек презентаций — по очереди.
const COVERS = [
  { bg: "#E3E600", fg: "#2b2b2b" },
  { bg: "#FF9EC4", fg: "#2b2b2b" },
  { bg: "#7CF0C5", fg: "#2b2b2b" },
  { bg: "#B9A3FF", fg: "#2b2b2b" },
  { bg: "#FFC93C", fg: "#2b2b2b" },
];
const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} в ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
};
type Kind = "TRUE_FALSE" | "FIX_ERROR" | "LANGUAGE";
type Item = { id: string; kind: Kind; prompt: string; answer: string | null; isCorrect: boolean | null; explanation: string | null; image: string | null };
type LangItem = { id: string; prompt: string; options: string[]; correctIndex: number; explanation: string | null; category: string | null };

// Обучение: презентации для изучения и три игры для закрепления правил.
export default function LearnPage() {
  const [presentations, setPresentations] = useState<Presentation[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [languages, setLanguages] = useState<Record<string, number>>({});
  const [viewing, setViewing] = useState<Presentation | null>(null);
  const [game, setGame] = useState<Kind | null>(null);
  const [timers, setTimers] = useState<Record<GameTimerKind, number>>({ ...GAME_TIMER_DEFAULTS });

  useEffect(() => {
    fetch("/api/learning/presentations").then((r) => r.json()).then((d) => setPresentations(d.items ?? []));
    fetch("/api/learning/games").then((r) => r.json()).then((d) => {
      setCounts(d.counts ?? {});
      setLanguages(d.languages ?? {});
      if (d.timers) setTimers(d.timers);
    });
  }, []);

  if (game === "LANGUAGE") return <LanguageGame counts={languages} seconds={timers.LANGUAGE} onExit={() => setGame(null)} />;
  if (game) return <Game kind={game} seconds={timers[game]} onExit={() => setGame(null)} />;

  return (
    <main className="container">
      <h1>📖 Обучение</h1>
      <p className="muted">Изучите материалы, закрепите правила в играх — и проверьте себя в тестах.</p>

      <h2 className="mt-lg">🎮 Игры</h2>
      <div className="grid grid-2">
        <button className="card level-card" style={{ ["--level" as any]: "#00E5A0", textAlign: "left", font: "inherit" }} disabled={!counts.TRUE_FALSE} onClick={() => setGame("TRUE_FALSE")}>
          <div style={{ fontSize: 34 }}>✅❌</div>
          <div className="level-title">Можно или нельзя?</div>
          <div className="muted">Так можно ответить клиенту? Решайте быстро — {timers.TRUE_FALSE} секунд на ответ, сразу увидите, почему.</div>
          <div className="level-meta">{counts.TRUE_FALSE ? "12 фраз за раунд" : "Скоро — фразы готовятся"}</div>
        </button>
        <button className="card level-card" style={{ ["--level" as any]: "#FFC93C", textAlign: "left", font: "inherit" }} disabled={!counts.LANGUAGE} onClick={() => setGame("LANGUAGE")}>
          <div style={{ fontSize: 34 }}>✍️⏱️</div>
          <div className="level-title">Грамотность</div>
          <div className="muted">Предлоги, окончания, слитно или раздельно, орфография. Русский или узбекский — {timers.LANGUAGE} секунд на вопрос!</div>
          <div className="level-meta">{counts.LANGUAGE ? `${LANGUAGE_ROUND} вопросов за раунд` : "Скоро — вопросы готовятся"}</div>
        </button>
        <button className="card level-card" style={{ ["--level" as any]: "#FF6FA5", textAlign: "left", font: "inherit" }} disabled={!counts.FIX_ERROR} onClick={() => setGame("FIX_ERROR")}>
          <div style={{ fontSize: 34 }}>🔍✏️</div>
          <div className="level-title">Найди и исправь ошибку</div>
          <div className="muted">Сообщение или скриншот чата с ошибкой — напишите, как правильно, и сравните с образцом.</div>
          <div className="level-meta">{counts.FIX_ERROR ? `${Math.min(counts.FIX_ERROR, 12)} заданий за раунд` : "Скоро — задания готовятся"}</div>
        </button>
      </div>

      <h2 className="mt-lg">📊 Презентации</h2>
      {!presentations ? (
        <div className="card"><div className="spinner" /></div>
      ) : presentations.length === 0 ? (
        <div className="card muted center">Презентаций пока нет</div>
      ) : (
        <div className="pres-grid">
          {presentations.map((p, i) => {
            const cover = COVERS[i % COVERS.length];
            return (
              <button key={p.id} className="pres-card" onClick={() => setViewing(p)}>
                <div className="pres-cover" style={{ background: cover.bg, color: cover.fg }}>
                  <div className="pres-cover-title">{p.title}</div>
                  <div className="pres-cover-bottom">
                    {/* Номер по порядку загрузки: у новой презентации — самый большой. */}
                    <span className="pres-cover-num">{presentations.length - i}</span>
                    {p.description && <span className="pres-cover-tag">{p.description}</span>}
                  </div>
                </div>
                <div className="pres-body">
                  <div className="pres-meta">{formatDate(p.createdAt)}</div>
                  <div className="pres-title">{p.title}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {viewing && <PresentationModal p={viewing} onClose={() => setViewing(null)} />}
    </main>
  );
}

// Окно презентации. «На весь экран» раскрывает её на весь экран телефона (Fullscreen API,
// а где его нет, например на iPhone, — окно просто растягивается). Выйти — той же кнопкой,
// клавишей Esc или кнопкой «Назад» телефона: для этого раскрытие добавляет шаг в историю.
function PresentationModal({ p, onClose }: { p: Presentation; onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onPop = () => {
      setFull(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    // Вышли из полноэкранного режима системно (Esc, жест) — убираем и наш шаг истории.
    const onFsChange = () => {
      if (!document.fullscreenElement && history.state?.presentationFull) history.back();
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, []);

  function expand() {
    history.pushState({ presentationFull: true }, "");
    setFull(true);
    card.current?.requestFullscreen?.().catch(() => {});
  }

  function collapse() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); // дальше — onFsChange → history.back
    else if (history.state?.presentationFull) history.back();
    else setFull(false);
  }

  function close() {
    if (full) collapse();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <div ref={card} className={`card presentation-card ${full ? "fullview" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 8, flexWrap: "nowrap" }}>
          <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</strong>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            {full ? (
              <button className="btn btn-ghost btn-sm" onClick={collapse}>
                ✕ Свернуть
              </button>
            ) : (
              <>
                <button className="btn btn-ghost btn-sm" onClick={expand}>
                  ⛶ На весь экран
                </button>
                <button className="btn btn-primary btn-sm" onClick={close}>
                  Закрыть
                </button>
              </>
            )}
          </div>
        </div>
        {isPowerPoint(p.fileName) ? (
          <iframe src={viewerUrl(p)} title={p.title} allowFullScreen style={{ flex: 1, border: 0, borderRadius: 12, background: "#fff" }} />
        ) : (
          <PdfViewer src={viewerUrl(p)} />
        )}
      </div>
    </div>
  );
}

// Сколько секунд осталось на текущий ответ: таймер перезапускается, когда меняется key, и стоит, пока running = false.
function useCountdown(seconds: number, key: string, running: boolean) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => setLeft(seconds), [seconds, key]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [running, key]);
  return left;
}

function TimeBar({ left, seconds }: { left: number; seconds: number }) {
  const fmt = left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : String(left);
  return (
    <>
      <div className="row between">
        <span className="muted small">Время на ответ</span>
        <span className={`timer ${left <= 3 ? "danger" : ""}`}>⏱ {fmt}</span>
      </div>
      <div className="lang-timebar">
        <div style={{ width: `${(left / seconds) * 100}%` }} />
      </div>
    </>
  );
}

// «Можно или нельзя?» и «Найди и исправь ошибку». На каждый ответ — таймер (seconds): не успел —
// ответ засчитывается как неверный и показывается правильный.
function Game({ kind, seconds, onExit }: { kind: Kind; seconds: number; onExit: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null); // выбор в «Можно или нельзя?»
  const [flipped, setFlipped] = useState(false);
  const [draft, setDraft] = useState(""); // исправленный вариант в «Найди и исправь ошибку»
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setItems(null);
    setTimedOut(false);
    fetch(`/api/learning/games?kind=${kind}`).then((r) => r.json()).then((d) => setItems(d.items ?? []));
    setI(0);
    setScore(0);
    setPicked(null);
    setFlipped(false);
    setDraft("");
  }, [kind, round]);

  const answering = !!items && i < items.length && (kind === "TRUE_FALSE" ? picked === null : !flipped);
  const left = useCountdown(seconds, `${round}:${i}`, answering);

  // Время вышло: «Можно или нельзя?» — неверно; «Найди и исправь» — показываем правильный вариант,
  // пустой ответ сразу считается ошибкой, написанный — сотрудник сравнивает сам.
  useEffect(() => {
    if (!answering || left > 0 || !items) return;
    setTimedOut(true);
    if (kind === "TRUE_FALSE") setPicked(!items[i].isCorrect);
    else {
      setFlipped(true);
      if (!draft.trim()) setPicked(false);
    }
  }, [answering, left, items, i, kind, draft]);

  if (!items) return <main className="container narrow"><div className="card center" style={{ padding: 40 }}><div className="spinner" /></div></main>;

  const done = i >= items.length;
  const item = items[i];
  const next = () => {
    setI(i + 1);
    setPicked(null);
    setFlipped(false);
    setDraft("");
    setTimedOut(false);
  };

  return (
    <main className="container narrow">
      <div className="row between">
        <button className="btn btn-ghost btn-sm" onClick={onExit}>← К обучению</button>
        <span className="badge">{`Очки: ${score}`}</span>
      </div>
      <div className="progress mt">
        {items.map((_, k) => (
          <div key={k} className={`seg ${k < i ? "done" : k === i ? "current" : ""}`} />
        ))}
      </div>

      {done ? (
        <div className="card center stack mt">
          <div style={{ fontSize: 56 }}>{score === items.length ? "🏆" : "🎉"}</div>
          <h2>{`Правильно ${score} из ${items.length}`}</h2>
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => setRound(round + 1)}>Ещё раунд</button>
            <button className="btn btn-ghost" onClick={onExit}>К обучению</button>
          </div>
        </div>
      ) : kind === "FIX_ERROR" ? (
        // Свободный ответ сравнивает сам сотрудник: показываем образец и спрашиваем, совпало ли.
        <div className="card stack mt">
          {answering && <TimeBar left={left} seconds={seconds} />}
          {timedOut && <div className="alert alert-error">⏰ Время вышло</div>}
          <div className="muted small">Найдите ошибку и напишите, как правильно</div>
          {item.image && <img src={item.image} alt="Скриншот чата" className="question-image" />}
          {item.prompt && <div className="question-text">«{item.prompt}»</div>}
          <textarea className="textarea" placeholder="Ваш исправленный вариант" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={flipped} />
          {!flipped ? (
            <button className="btn btn-primary btn-block" onClick={() => setFlipped(true)} disabled={!draft.trim()}>
              Проверить
            </button>
          ) : picked === null ? (
            <>
              <div className="answer-box ok">
                <div className="muted small">Правильный вариант</div>
                {item.answer}
                {item.explanation && <div style={{ marginTop: 6 }}>💡 {item.explanation}</div>}
              </div>
              <div className="muted small center">Ваш вариант совпадает по смыслу?</div>
              <div className="grid grid-2">
                <button className="btn btn-primary" onClick={() => { setPicked(true); setScore(score + 1); }}>✅ Да, исправил</button>
                <button className="btn btn-danger" onClick={() => setPicked(false)}>❌ Нет, ошибся</button>
              </div>
            </>
          ) : (
            <>
              <div className={`answer-box ${picked ? "ok" : "bad"}`}>
                {picked ? "✅ Отлично! " : "Запомните правильный вариант: "}
                {!picked && item.answer}
              </div>
              <button className="btn btn-primary btn-block" onClick={next}>Дальше →</button>
            </>
          )}
        </div>
      ) : (
        <div className="card stack mt">
          {answering && <TimeBar left={left} seconds={seconds} />}
          <div className="muted small">Так можно ответить клиенту?</div>
          <div className="question-text">«{item.prompt}»</div>
          {picked === null ? (
            <div className="grid grid-2">
              <button className="btn btn-primary" style={{ fontSize: 18, padding: 18 }} onClick={() => { setPicked(true); if (item.isCorrect) setScore(score + 1); }}>✅ Можно</button>
              <button className="btn btn-danger" style={{ fontSize: 18, padding: 18 }} onClick={() => { setPicked(false); if (!item.isCorrect) setScore(score + 1); }}>❌ Нельзя</button>
            </div>
          ) : (
            <>
              <div className={`answer-box ${picked === item.isCorrect ? "ok" : "bad"}`}>
                {timedOut ? "⏰ Время вышло. " : picked === item.isCorrect ? "✅ Верно! " : "❌ Не совсем. "}
                {item.isCorrect ? "Так говорить можно." : "Так говорить нельзя."}
                {item.explanation && <div style={{ marginTop: 6 }}>💡 {item.explanation}</div>}
              </div>
              <button className="btn btn-primary btn-block" onClick={next}>Дальше →</button>
            </>
          )}
        </div>
      )}
    </main>
  );
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LANG_LABEL: Record<string, { flag: string; name: string }> = {
  ru: { flag: "🇷🇺", name: "Русский язык" },
  uz: { flag: "🇺🇿", name: "Oʻzbek tili" },
};

// «Грамотность»: сначала выбор языка (русский и узбекский — отдельно, не вперемешку),
// затем раунд: на каждый вопрос seconds секунд (настройка «Таймеры в играх»), не успел — ответ засчитывается как ошибка.
function LanguageGame({ counts, seconds, onExit }: { counts: Record<string, number>; seconds: number; onExit: () => void }) {
  const [language, setLanguage] = useState<"ru" | "uz" | null>(null);

  if (!language) {
    return (
      <main className="container narrow">
        <button className="btn btn-ghost btn-sm" onClick={onExit}>← К обучению</button>
        <h1 className="mt">✍️ Грамотность</h1>
        <p className="muted">Выберите язык. На каждый вопрос — {seconds} секунд.</p>
        <div className="grid grid-2">
          {(["ru", "uz"] as const).map((l) => (
            <button key={l} className="card level-card" style={{ ["--level" as any]: l === "ru" ? "#7C4DFF" : "#00E5A0", textAlign: "left", font: "inherit" }} disabled={!counts[l]} onClick={() => setLanguage(l)}>
              <div style={{ fontSize: 34 }}>{LANG_LABEL[l].flag}</div>
              <div className="level-title">{LANG_LABEL[l].name}</div>
              <div className="level-meta">{counts[l] ? `${Math.min(counts[l], LANGUAGE_ROUND)} вопросов за раунд` : "Скоро — вопросы готовятся"}</div>
            </button>
          ))}
        </div>
      </main>
    );
  }
  return <LanguageRound language={language} seconds={seconds} onBack={() => setLanguage(null)} onExit={onExit} />;
}

function LanguageRound({ language, seconds, onBack, onExit }: { language: "ru" | "uz"; seconds: number; onBack: () => void; onExit: () => void }) {
  const [items, setItems] = useState<LangItem[] | null>(null);
  const [round, setRound] = useState(0);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // -1 — время вышло
  const [left, setLeft] = useState(seconds);
  const [score, setScore] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setItems(null);
    setI(0);
    setScore(0);
    setPicked(null);
    setLeft(seconds);
    fetch(`/api/learning/games?kind=LANGUAGE&language=${language}`).then((r) => r.json()).then((d) => setItems(d.items ?? []));
  }, [language, round]);

  const item = items?.[i];
  // Варианты перемешиваем один раз на вопрос, правильный запоминаем по тексту.
  const options = useMemo(() => (item ? shuffled(item.options.map((text, k) => ({ text, ok: k === item.correctIndex }))) : []), [item]);

  useEffect(() => {
    if (!item) return;
    setLeft(seconds);
    timer.current = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [item]);

  useEffect(() => {
    if (left <= 0 && picked === null && item) {
      if (timer.current) clearInterval(timer.current);
      setPicked(-1);
    }
  }, [left, picked, item]);

  // Время сбрасываем вместе с переходом, иначе после «время вышло» следующий вопрос
  // на один кадр видел бы 0 секунд и тоже засчитывался как просроченный.
  function next() {
    setLeft(seconds);
    setPicked(null);
    setI(i + 1);
  }

  function choose(k: number) {
    if (picked !== null) return;
    if (timer.current) clearInterval(timer.current);
    setPicked(k);
    if (options[k].ok) setScore((s) => s + 1);
  }

  if (!items) return <main className="container narrow"><div className="card center" style={{ padding: 40 }}><div className="spinner" /></div></main>;

  const done = i >= items.length;
  const right = options.find((o) => o.ok)?.text;

  return (
    <main className="container narrow">
      <div className="row between">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Выбор языка</button>
        <span className="badge">{LANG_LABEL[language].flag} Очки: {score}</span>
      </div>
      <div className="progress mt">
        {items.map((_, k) => (
          <div key={k} className={`seg ${k < i ? "done" : k === i ? "current" : ""}`} />
        ))}
      </div>

      {done ? (
        <div className="card center stack mt">
          <div style={{ fontSize: 56 }}>{score === items.length ? "🏆" : score >= items.length * 0.7 ? "🎉" : "📚"}</div>
          <h2>Правильно {score} из {items.length}</h2>
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => setRound(round + 1)}>Ещё раунд</button>
            <button className="btn btn-ghost" onClick={onExit}>К обучению</button>
          </div>
        </div>
      ) : (
        item && (
          <div className="card stack mt">
            <div className="row between">
              <span className="muted small">{item.category ?? ""}</span>
              <span className={`timer ${picked === null && left <= 3 ? "danger" : ""}`}>⏱ {Math.max(left, 0)}</span>
            </div>
            <div className="lang-timebar">
              <div style={{ width: `${(Math.max(left, 0) / seconds) * 100}%` }} />
            </div>
            <div className="question-text">{item.prompt}</div>
            <div className="stack" style={{ gap: 8 }}>
              {options.map((o, k) => (
                <button
                  key={k}
                  className={`option ${picked !== null && o.ok ? "correct" : ""} ${picked === k && !o.ok ? "wrong" : ""}`}
                  disabled={picked !== null}
                  onClick={() => choose(k)}
                >
                  {o.text}
                </button>
              ))}
            </div>
            {picked !== null && (
              <>
                <div className={`answer-box ${picked >= 0 && options[picked].ok ? "ok" : "bad"}`}>
                  {picked === -1 ? `⏰ Время вышло. Правильно: ${right}` : options[picked].ok ? "✅ Верно!" : `❌ Правильно: ${right}`}
                  {item.explanation && <div style={{ marginTop: 6 }}>💡 {item.explanation}</div>}
                </div>
                <button className="btn btn-primary btn-block" onClick={next}>
                  {i + 1 < items.length ? "Дальше →" : "Результат →"}
                </button>
              </>
            )}
          </div>
        )
      )}
    </main>
  );
}
