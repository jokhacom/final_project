"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EXTRA_KEYS, sameChar, TYPING_LABEL, TYPING_LANGUAGES, TYPING_MODES, TYPING_WORDS, type TypingLanguage } from "@/lib/typingWords";

type Stats = { wpm: number; rawWpm: number; accuracy: number; correctChars: number; wrongWords: number };
type Board = { top: { name: string; wpm: number; accuracy: number; me: boolean }[]; personalBest: { wpm: number; accuracy: number } | null };

const randomWords = (lang: TypingLanguage, n = 250) => {
  const list = TYPING_WORDS[lang];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let w = list[Math.floor(Math.random() * list.length)];
    if (w === out[out.length - 1]) w = list[(list.indexOf(w) + 1) % list.length]; // без повтора подряд
    out.push(w);
  }
  return out;
};
const sameWord = (typed: string, word: string) => typed.length === word.length && [...word].every((c, i) => sameChar(typed[i], c));

// Тест скорости печати в стиле monkeytype: время идёт с первого нажатия, пробел — следующее слово,
// Backspace в пустом слове возвращает к предыдущему, если в нём ошибка.
export default function TypingPage() {
  const [language, setLanguage] = useState<TypingLanguage>("ru");
  const [seconds, setSeconds] = useState<number>(30);
  const [words, setWords] = useState<string[]>([]);
  const [typed, setTyped] = useState<string[]>([]); // завершённые слова
  const [input, setInput] = useState(""); // текущее слово
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [stats, setStats] = useState<Stats | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [record, setRecord] = useState(false);
  const keys = useRef({ total: 0, correct: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  const loadBoard = useCallback(
    () => fetch(`/api/typing?language=${language}&seconds=${seconds}`).then((r) => r.json()).then((d) => setBoard(d.top ? d : null)),
    [language, seconds]
  );

  const restart = useCallback(() => {
    setWords(randomWords(language));
    setTyped([]);
    setInput("");
    setStartedAt(null);
    setStats(null);
    setRecord(false);
    setOffset(0);
    keys.current = { total: 0, correct: 0 };
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [language]);

  useEffect(() => {
    restart();
    loadBoard();
  }, [restart, loadBoard]);

  // Таймер
  useEffect(() => {
    if (!startedAt || stats) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [startedAt, stats]);
  const elapsed = startedAt ? Math.min(seconds, (now - startedAt) / 1000) : 0;
  const left = Math.ceil(seconds - elapsed);

  const finish = useCallback(() => {
    // Верные символы — только полностью верные слова (+ пробел после них) и верное начало текущего слова.
    let correctChars = 0;
    let allChars = 0;
    let wrongWords = 0;
    typed.forEach((t, i) => {
      allChars += t.length + 1;
      if (sameWord(t, words[i])) correctChars += words[i].length + 1;
      else wrongWords++;
    });
    const cur = words[typed.length] ?? "";
    allChars += input.length;
    if ([...input].every((c, i) => sameChar(c, cur[i] ?? ""))) correctChars += input.length;
    const minutes = seconds / 60;
    const result: Stats = {
      wpm: Math.round(correctChars / 5 / minutes),
      rawWpm: Math.round(allChars / 5 / minutes),
      accuracy: keys.current.total ? Math.round((keys.current.correct / keys.current.total) * 100) : 0,
      correctChars,
      wrongWords,
    };
    setStats(result);
    if (result.wpm > 0) {
      const prevBest = board?.personalBest?.wpm ?? 0;
      setRecord(result.wpm > prevBest);
      fetch("/api/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, seconds, ...result }),
      }).then(loadBoard);
    }
  }, [typed, words, input, seconds, language, board, loadBoard]);

  useEffect(() => {
    if (startedAt && !stats && elapsed >= seconds) finish();
  }, [elapsed, startedAt, stats, seconds, finish]);

  function onChange(value: string) {
    if (stats) return;
    if (!startedAt && value) {
      setStartedAt(Date.now());
      setNow(Date.now());
    }
    const word = words[typed.length] ?? "";
    // Пробел — следующее слово (пустое слово пробелом не пропускается).
    if (value.endsWith(" ")) {
      const done = value.trim();
      if (!done) return;
      keys.current.total++;
      if (sameWord(done, word)) keys.current.correct++;
      setTyped([...typed, done]);
      setInput("");
      return;
    }
    if (value.length > input.length) {
      for (let i = input.length; i < value.length; i++) {
        keys.current.total++;
        if (word[i] !== undefined && sameChar(value[i], word[i])) keys.current.correct++;
      }
    }
    setInput(value);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return restart();
    // Backspace в пустом слове — назад, если предыдущее слово набрано с ошибкой.
    if (e.key === "Backspace" && !input && typed.length) {
      const prev = typed[typed.length - 1];
      if (!sameWord(prev, words[typed.length - 1])) {
        e.preventDefault();
        setTyped(typed.slice(0, -1));
        setInput(prev);
      }
    }
  }

  function addChar(c: string) {
    onChange(input + c);
    inputRef.current?.focus();
  }

  // Курсор в скрытом поле всегда в конце: иначе при вводе через раскладку/IME буквы могут встать в начало.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && el.selectionStart !== input.length) el.setSelectionRange(input.length, input.length);
  }, [input]);

  // Прокрутка строк: текущее слово всегда во второй строке.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = box?.querySelector<HTMLElement>(".tw-word.active");
    if (!box || !el) return;
    const line = el.offsetHeight;
    setOffset(Math.max(0, el.offsetTop - line));
  }, [typed.length, words]);

  const visible = useMemo(() => words.slice(0, typed.length + 80), [words, typed.length]);

  return (
    <main className="container narrow">
      <div className="row between">
        <h1 style={{ margin: 0 }}>⌨️ Скорость печати</h1>
        <Link href="/learn" className="btn btn-ghost btn-sm">
          ← К обучению
        </Link>
      </div>
      <p className="muted">Печатайте слова как можно быстрее и без ошибок. Время пойдёт с первой буквы. Esc — начать заново.</p>

      <div className="row between" style={{ gap: 8 }}>
        <div className="tabs" style={{ maxWidth: 520 }}>
          {TYPING_LANGUAGES.map((l) => (
            <button key={l} className={language === l ? "active" : ""} onClick={() => setLanguage(l)}>
              {TYPING_LABEL[l]}
            </button>
          ))}
        </div>
        <div className="tabs" style={{ maxWidth: 320 }}>
          {TYPING_MODES.map((s) => (
            <button key={s} className={seconds === s ? "active" : ""} onClick={() => setSeconds(s)}>
              {s} с
            </button>
          ))}
        </div>
      </div>

      {!stats ? (
        <div className="card mt stack" onClick={() => inputRef.current?.focus()}>
          <div className="row between">
            <span className="timer">⏱ {startedAt ? left : seconds}</span>
            <span className="muted small">{typed.length} слов</span>
          </div>
          <div className="tw-box" ref={boxRef}>
            <div className="tw-words" style={{ transform: `translateY(-${offset}px)` }}>
              {visible.map((w, wi) => {
                const isDone = wi < typed.length;
                const isActive = wi === typed.length;
                const t = isDone ? typed[wi] : isActive ? input : "";
                const wrongWord = isDone && !sameWord(t, w);
                return (
                  <span key={wi} className={`tw-word ${isActive ? "active" : ""} ${isDone ? "done" : ""} ${wrongWord ? "wrong" : ""}`}>
                    {[...w].map((c, ci) => {
                      const cls = ci < t.length ? (sameChar(t[ci], c) ? "ok" : "bad") : "";
                      return (
                        <span key={ci} className={`tw-char ${cls}`}>
                          {c}
                        </span>
                      );
                    })}
                    {t.length > w.length && <span className="tw-char extra">{t.slice(w.length)}</span>}
                  </span>
                );
              })}
            </div>
          </div>
          <input
            ref={inputRef}
            className="tw-input"
            value={input}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Поле ввода"
          />
          {EXTRA_KEYS[language].length > 0 && (
            <div className="row" style={{ gap: 6 }}>
              <span className="muted small">Нет на клавиатуре? Нажмите:</span>
              {EXTRA_KEYS[language].map((k) => (
                <button key={k} className="btn btn-ghost btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => addChar(k)}>
                  {k}
                </button>
              ))}
              {language === "uz" && <span className="muted small">Апостроф &apos; тоже подходит.</span>}
            </div>
          )}
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn btn-ghost btn-sm" onClick={restart}>
              ↻ Заново
            </button>
          </div>
        </div>
      ) : (
        <div className="card mt stack center">
          {record && <div className="badge" style={{ alignSelf: "center" }}>🏆 Новый личный рекорд!</div>}
          <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1 }}>{stats.wpm}</div>
          <div className="muted">слов в минуту</div>
          <div className="grid" style={{ marginTop: 8, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
            {[
              ["Точность", `${stats.accuracy}%`],
              ["Без учёта ошибок", `${stats.rawWpm} сл/мин`],
              ["Верных символов", stats.correctChars],
              ["Слов с ошибкой", stats.wrongWords],
            ].map(([k, v]) => (
              <div key={k as string}>
                <div style={{ fontWeight: 900, fontSize: 20 }}>{v}</div>
                <div className="muted small">{k}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ alignSelf: "center" }} onClick={restart}>
            ↻ Ещё раз
          </button>
        </div>
      )}

      <div className="card mt">
        <h2>
          🏆 Лучшие — {TYPING_LABEL[language]}, {seconds} с
        </h2>
        {board?.personalBest && (
          <p className="muted small">
            Ваш рекорд: <strong>{board.personalBest.wpm} сл/мин</strong>, точность {board.personalBest.accuracy}%
          </p>
        )}
        {!board || board.top.length === 0 ? (
          <p className="muted small">Пока никто не проходил — будьте первым!</p>
        ) : (
          <table className="table">
            <tbody>
              {board.top.map((r, i) => (
                <tr key={i} style={r.me ? { fontWeight: 800 } : undefined}>
                  <td>{["🥇", "🥈", "🥉"][i] ?? i + 1}</td>
                  <td>{r.name}</td>
                  <td>{r.wpm} сл/мин</td>
                  <td className="muted">{r.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
