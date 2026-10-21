"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LEVEL_LABEL, QuestionForm, TYPE_LABEL, toDraft } from "@/components/admin/QuestionForm";
import { useAdminStatus } from "@/components/admin/useAdminStatus";

type Q = {
  id: string;
  type: string;
  level: string;
  text: string;
  options: string[] | null;
  correctIndex: number | null;
  expectedKeywords: string[] | null;
  modelAnswer: string | null;
  explanation: string | null;
  image: string | null;
  sourceMaterial: { title: string; version: number } | null;
  topic: { name: string } | null;
  createdAt: string;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Банк вопросов: просмотр, правка, удаление и перегенерация ИИ.
export default function QuestionsPage() {
  const [level, setLevel] = useState("");
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [showArchive, setShowArchive] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const status = useAdminStatus([reload]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok?: string; error?: string; errors?: string[] } | null>(null);

  async function load() {
    const params = new URLSearchParams({ ...(level && { level }), ...(showArchive && { archived: "1" }) });
    const res = await fetch(`/api/questions/manual?${params}`);
    const data = await res.json();
    setQuestions(data.questions ?? []);
    setArchivedCount(data.archivedCount ?? 0);
    setReload((n) => n + 1);
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    const form = new FormData();
    form.append("file", importFile);
    const res = await fetch("/api/questions/import", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setImporting(false);
    if (!res.ok) {
      setImportResult({ error: data.error ?? "Ошибка импорта", errors: data.errors });
      return;
    }
    setImportResult({ ok: `Загружено вопросов: ${data.imported}` });
    setImportFile(null);
    load();
  }

  useEffect(() => {
    setQuestions(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, showArchive]);

  async function act(id: string, method: "DELETE" | "POST" | "ARCHIVE" | "RESTORE") {
    if (method === "DELETE" && !confirm("Удалить вопрос навсегда? Вернуть его будет нельзя, ответы сотрудников на него тоже удалятся.")) return;
    setBusy(id);
    setError(null);
    const res =
      method === "ARCHIVE" || method === "RESTORE"
        ? await fetch(`/api/questions/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: method === "ARCHIVE" }),
          })
        : await fetch(`/api/questions/${id}`, { method });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setError(data.error ?? "Ошибка");
    load();
  }

  // Все показанные сейчас вопросы (с учётом фильтра уровня) — в архив или обратно.
  async function bulk(archived: boolean) {
    const ids = (questions ?? []).map((q) => q.id);
    const what = level ? `«${LEVEL_LABEL[level]}»` : "всех уровней";
    if (!ids.length || !confirm(archived ? `Убрать в архив все показанные вопросы ${what} (${ids.length})? Их можно будет вернуть.` : `Вернуть в тесты все вопросы из архива (${ids.length})?`)) return;
    setBusy("bulk");
    setError(null);
    const res = await fetch("/api/questions/manual", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, archived }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setError(data.error ?? "Ошибка");
    load();
  }

  const counts = (questions ?? []).reduce<Record<string, number>>((acc, q) => {
    acc[q.level] = (acc[q.level] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="row between">
        <h1>Банк вопросов</h1>
        <Link href="/admin/questions/new" className="btn btn-primary">
          + Добавить вручную
        </Link>
      </div>
      <p className="muted small">
        Уровень открывается у сотрудников, как только в нём есть хотя бы 1 вопрос. В тест попадает столько вопросов, сколько есть, но не
        больше настройки «вопросов в тесте» на «Обзоре». «🗄 В архив» убирает вопрос из тестов — вернуть его можно в любой момент.
      </p>

      <div className="card stack" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>📥 Импорт из Excel</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Скачайте шаблон, заполните вопросы по документам (Редполитика, Tone of Voice) и загрузите файл. Можно загружать сколько угодно раз — новые
          вопросы добавятся к существующим.
        </p>
        <div className="row">
          <a className="btn btn-ghost btn-sm" href="/api/questions/import">
            ⬇️ Скачать шаблон
          </a>
          <input type="file" accept=".xlsx" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
          <button className="btn btn-primary btn-sm" onClick={handleImport} disabled={!importFile || importing}>
            {importing ? "Загружаем..." : "Загрузить"}
          </button>
        </div>
        {importResult?.ok && <div className="alert alert-success">{importResult.ok}</div>}
        {importResult?.error && (
          <div className="alert alert-error">
            {importResult.error}
            {importResult.errors && (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {importResult.errors.slice(0, 20).map((e) => (
                  <li key={e}>{e}</li>
                ))}
                {importResult.errors.length > 20 && <li>…и ещё {importResult.errors.length - 20}</li>}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="tabs" style={{ maxWidth: 460, marginBottom: 12 }}>
        <button className={!showArchive ? "active" : ""} onClick={() => setShowArchive(false)}>
          В тестах
        </button>
        <button className={showArchive ? "active" : ""} onClick={() => setShowArchive(true)}>
          🗄 Архив ({archivedCount})
        </button>
      </div>
      {showArchive && (
        <p className="muted small">Вопросы в архиве не попадают в тесты, но хранятся. «↩ Вернуть» — снова в тесты.</p>
      )}

      <div className="row">
        <select className="select" style={{ maxWidth: 240 }} value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">Все уровни</option>
          {Object.entries(LEVEL_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {!level &&
          !showArchive &&
          Object.entries(LEVEL_LABEL).map(([v, l]) => {
            const s = status?.levels.find((x) => x.id === v);
            return (
              <span key={v} className="badge" title={s ? `${s.choice} с вариантами, ${s.open} открытых` : undefined}>
                {s ? (s.ready ? "✅" : "❌") : ""} {l}: {counts[v] ?? 0}
              </span>
            );
          })}
      </div>

      {!!questions?.length && (
        <div className="row mt">
          <button className="btn btn-ghost btn-sm" disabled={busy === "bulk"} onClick={() => bulk(!showArchive)}>
            {showArchive
              ? `↩ Вернуть все в тесты (${questions.length})`
              : `🗄 Убрать в архив все показанные (${questions.length})`}
          </button>
          {!showArchive && !level && <span className="muted small">Чтобы убрать только один уровень, сначала выберите его в списке.</span>}
        </div>
      )}

      {error && <div className="alert alert-error mt">{error}</div>}

      <div className="stack mt">
        {!questions ? (
          <div className="card"><div className="spinner" /></div>
        ) : questions.length === 0 ? (
          <div className="card muted center">{showArchive ? "Архив пуст" : "Вопросов пока нет"}</div>
        ) : (
          questions.map((q) =>
            editing === q.id ? (
              <div key={q.id} className="card">
                <QuestionForm initial={toDraft(q)} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />
              </div>
            ) : (
              <div key={q.id} className="card">
                <div className="row" style={{ gap: 6 }}>
                  <span className="muted small">{formatDate(q.createdAt)}</span>
                  <span className="badge">{LEVEL_LABEL[q.level] ?? q.level}</span>
                  <span className="badge">{TYPE_LABEL[q.type] ?? q.type}</span>
                  {q.sourceMaterial && (
                    <span className="badge">
                      📄 {q.sourceMaterial.title} v{q.sourceMaterial.version}
                      {q.topic ? ` · ${q.topic.name}` : ""}
                    </span>
                  )}
                </div>
                <p style={{ fontWeight: 700, whiteSpace: "pre-wrap" }}>{q.text}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {q.image && <img src={q.image} alt="Скриншот" className="question-image" style={{ maxHeight: 180, marginBottom: 8 }} />}
                {q.options ? (
                  <ol className="small" style={{ margin: 0 }}>
                    {q.options.map((o, i) => (
                      <li key={i} style={{ fontWeight: i === q.correctIndex ? 800 : 400, color: i === q.correctIndex ? "var(--success)" : undefined }}>
                        {o}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="small muted stack" style={{ gap: 4 }}>
                    {q.modelAnswer && <div>Эталонный ответ: {q.modelAnswer}</div>}
                    {!!q.expectedKeywords?.length && <div>Ключевые слова: {q.expectedKeywords.join(", ")}</div>}
                  </div>
                )}
                {q.explanation && <div className="small muted mt">💡 {q.explanation}</div>}
                <div className="row mt">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(q.id)}>
                    ✏️ Изменить
                  </button>
                  {q.sourceMaterial && status?.ai.configured && (
                    <button className="btn btn-ghost btn-sm" disabled={busy === q.id} onClick={() => act(q.id, "POST")}>
                      🔄 Перегенерировать ИИ
                    </button>
                  )}
                  {showArchive ? (
                    <>
                      <button className="btn btn-primary btn-sm" disabled={busy === q.id} onClick={() => act(q.id, "RESTORE")}>
                        ↩ Вернуть в тесты
                      </button>
                      <button className="btn btn-danger btn-sm" disabled={busy === q.id} onClick={() => act(q.id, "DELETE")}>
                        Удалить навсегда
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-ghost btn-sm" disabled={busy === q.id} onClick={() => act(q.id, "ARCHIVE")} title="Убрать из тестов, можно вернуть">
                      🗄 В архив
                    </button>
                  )}
                </div>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
