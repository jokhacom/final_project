"use client";

import { useEffect, useState } from "react";

type Presentation = { id: string; title: string; description: string | null };
type Item = { id: string; kind: "TRUE_FALSE" | "FLASHCARD"; prompt: string; answer: string | null; isCorrect: boolean | null; explanation: string | null };

// Обучение: презентации для изучения и две игры для закрепления правил.
export default function LearnPage() {
  const [presentations, setPresentations] = useState<Presentation[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [viewing, setViewing] = useState<Presentation | null>(null);
  const [game, setGame] = useState<"TRUE_FALSE" | "FLASHCARD" | null>(null);

  useEffect(() => {
    fetch("/api/learning/presentations").then((r) => r.json()).then((d) => setPresentations(d.items ?? []));
    fetch("/api/learning/games").then((r) => r.json()).then((d) => setCounts(d.counts ?? {}));
  }, []);

  if (game) return <Game kind={game} onExit={() => setGame(null)} />;

  return (
    <main className="container">
      <h1>📖 Обучение</h1>
      <p className="muted">Изучите материалы, закрепите правила в играх — и проверьте себя в тестах.</p>

      <h2 className="mt-lg">🎮 Игры</h2>
      <div className="grid grid-2">
        <button className="card level-card" style={{ ["--level" as any]: "#00E5A0", textAlign: "left", font: "inherit" }} disabled={!counts.TRUE_FALSE} onClick={() => setGame("TRUE_FALSE")}>
          <div style={{ fontSize: 34 }}>✅❌</div>
          <div className="level-title">Можно или нельзя?</div>
          <div className="muted">Так можно ответить клиенту? Решайте быстро — сразу увидите, почему.</div>
          <div className="level-meta">{counts.TRUE_FALSE ? "12 фраз за раунд" : "Скоро — фразы готовятся"}</div>
        </button>
        <button className="card level-card" style={{ ["--level" as any]: "#FFC93C", textAlign: "left", font: "inherit" }} disabled={!counts.FLASHCARD} onClick={() => setGame("FLASHCARD")}>
          <div style={{ fontSize: 34 }}>🃏</div>
          <div className="level-title">Карточки</div>
          <div className="muted">Ситуация с клиентом — вспомните, как правильно, и переверните карточку.</div>
          <div className="level-meta">{counts.FLASHCARD ? "12 карточек за раунд" : "Скоро — карточки готовятся"}</div>
        </button>
      </div>

      <h2 className="mt-lg">📊 Презентации</h2>
      {!presentations ? (
        <div className="card"><div className="spinner" /></div>
      ) : presentations.length === 0 ? (
        <div className="card muted center">Презентаций пока нет</div>
      ) : (
        <div className="grid grid-2">
          {presentations.map((p) => (
            <button key={p.id} className="card" style={{ textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer" }} onClick={() => setViewing(p)}>
              <div style={{ fontSize: 28 }}>📊</div>
              <div style={{ fontWeight: 900, fontSize: 17 }}>{p.title}</div>
              {p.description && <div className="muted small">{p.description}</div>}
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <div className="modal-backdrop" onClick={() => setViewing(null)}>
          <div className="card" style={{ width: "min(1100px, 100%)", height: "90vh", display: "flex", flexDirection: "column", padding: 12 }} onClick={(e) => e.stopPropagation()}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <strong>{viewing.title}</strong>
              <div className="row">
                <a className="btn btn-ghost btn-sm" href={`/api/learning/presentations/${viewing.id}`} target="_blank" rel="noreferrer">
                  Открыть в новой вкладке
                </a>
                <button className="btn btn-primary btn-sm" onClick={() => setViewing(null)}>
                  Закрыть
                </button>
              </div>
            </div>
            <iframe src={`/api/learning/presentations/${viewing.id}`} title={viewing.title} style={{ flex: 1, border: 0, borderRadius: 12, background: "#fff" }} />
          </div>
        </div>
      )}
    </main>
  );
}

function Game({ kind, onExit }: { kind: "TRUE_FALSE" | "FLASHCARD"; onExit: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null); // выбор в «Можно или нельзя?»
  const [flipped, setFlipped] = useState(false);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);

  useEffect(() => {
    setItems(null);
    fetch(`/api/learning/games?kind=${kind}`).then((r) => r.json()).then((d) => setItems(d.items ?? []));
    setI(0);
    setScore(0);
    setPicked(null);
    setFlipped(false);
  }, [kind, round]);

  if (!items) return <main className="container narrow"><div className="card center" style={{ padding: 40 }}><div className="spinner" /></div></main>;

  const done = i >= items.length;
  const item = items[i];
  const next = () => {
    setI(i + 1);
    setPicked(null);
    setFlipped(false);
  };

  return (
    <main className="container narrow">
      <div className="row between">
        <button className="btn btn-ghost btn-sm" onClick={onExit}>← К обучению</button>
        <span className="badge">{kind === "TRUE_FALSE" ? `Очки: ${score}` : `Карточка ${Math.min(i + 1, items.length)} из ${items.length}`}</span>
      </div>
      <div className="progress mt">
        {items.map((_, k) => (
          <div key={k} className={`seg ${k < i ? "done" : k === i ? "current" : ""}`} />
        ))}
      </div>

      {done ? (
        <div className="card center stack mt">
          <div style={{ fontSize: 56 }}>{kind === "TRUE_FALSE" ? (score === items.length ? "🏆" : "🎉") : "🧠"}</div>
          <h2>{kind === "TRUE_FALSE" ? `Правильно ${score} из ${items.length}` : "Раунд пройден!"}</h2>
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => setRound(round + 1)}>Ещё раунд</button>
            <button className="btn btn-ghost" onClick={onExit}>К обучению</button>
          </div>
        </div>
      ) : kind === "TRUE_FALSE" ? (
        <div className="card stack mt">
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
                {picked === item.isCorrect ? "✅ Верно! " : "❌ Не совсем. "}
                {item.isCorrect ? "Так говорить можно." : "Так говорить нельзя."}
                {item.explanation && <div style={{ marginTop: 6 }}>💡 {item.explanation}</div>}
              </div>
              <button className="btn btn-primary btn-block" onClick={next}>Дальше →</button>
            </>
          )}
        </div>
      ) : (
        <div className="stack mt">
          <button className="card" style={{ minHeight: 220, textAlign: "center", font: "inherit", color: "inherit", cursor: "pointer", display: "grid", placeItems: "center" }} onClick={() => setFlipped(!flipped)}>
            {flipped ? (
              <div className="stack">
                <div className="muted small">Как правильно</div>
                <div className="question-text">{item.answer}</div>
                {item.explanation && <div className="muted small">💡 {item.explanation}</div>}
              </div>
            ) : (
              <div className="stack">
                <div className="muted small">Ситуация</div>
                <div className="question-text">{item.prompt}</div>
                <div className="muted small">Нажмите, чтобы перевернуть</div>
              </div>
            )}
          </button>
          <button className="btn btn-primary btn-block" onClick={next} disabled={!flipped}>
            {flipped ? "Следующая карточка →" : "Сначала вспомните ответ и переверните"}
          </button>
        </div>
      )}
    </main>
  );
}
