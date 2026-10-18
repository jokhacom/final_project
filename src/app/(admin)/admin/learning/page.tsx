"use client";

import { useEffect, useState } from "react";
import { ImagePicker } from "@/components/admin/ImagePicker";

type Presentation = { id: string; title: string; description: string | null; fileName: string; size: number; order: number; createdAt: string };
type GameItem = {
  id: string;
  kind: "TRUE_FALSE" | "FLASHCARD" | "FIX_ERROR";
  prompt: string;
  answer: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
  image: string | null;
  topic: { name: string } | null;
};

const KIND_LABEL = { TRUE_FALSE: "«Можно или нельзя?»", FLASHCARD: "«Карточки»", FIX_ERROR: "«Найди и исправь ошибку»" };
const emptyItem = (kind: GameItem["kind"]): Partial<GameItem> => ({ kind, prompt: "", answer: "", isCorrect: true, explanation: "", image: null });

async function send(url: string, method: string, body?: object) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Ошибка ${res.status}`);
  return data;
}

// Обучение: готовые презентации (PDF) и элементы трёх обучающих игр.
// Игры ИИ создаёт по темам документа только по команде администратора
// («Материалы» → «🎮 Создать игры»); здесь любой элемент можно добавить вручную, изменить или удалить.
export default function AdminLearningPage() {
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [items, setItems] = useState<GameItem[] | null>(null);
  const [kind, setKind] = useState<GameItem["kind"]>("TRUE_FALSE");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadPresentations = () => fetch("/api/learning/presentations").then((r) => r.json()).then((d) => setPresentations(d.items ?? []));
  const loadItems = () => fetch("/api/learning/games?all=1").then((r) => r.json()).then((d) => setItems(d.items ?? []));

  useEffect(() => {
    loadPresentations();
    loadItems();
  }, []);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    await act(async () => {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title);
      form.append("description", description);
      const res = await fetch("/api/learning/presentations", { method: "POST", body: form });
      if (res.status === 413) throw new Error("Файл слишком большой (лимит около 4 МБ) — сожмите PDF");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
      setFile(null);
      setFileKey((k) => k + 1);
      setTitle("");
      setDescription("");
      await loadPresentations();
    }, "Презентация загружена — сотрудники видят её в «Обучении»");
    setUploading(false);
  }

  const shown = (items ?? []).filter((i) => i.kind === kind);

  return (
    <div className="stack">
      <div>
        <h1>Обучение</h1>
        <p className="muted small">
          Сотрудники видят это в разделе «📖 Обучение»: презентации для изучения и игры для закрепления. Игры ИИ создаёт по темам документа, когда вы
          нажмёте «Материалы» → «🎮 Создать игры». Здесь любой элемент можно добавить вручную, изменить или удалить.
        </p>
      </div>

      {msg && <div className={`alert ${msg.ok ? "alert-success" : "alert-error"}`}>{msg.text}</div>}

      <div className="card stack">
        <h2>📊 Презентации</h2>
        <div className="grid grid-2">
          <input className="input" placeholder="Название (необязательно)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" placeholder="Описание (необязательно)" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="row">
          <input key={fileKey} type="file" accept=".pdf,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button className="btn btn-primary btn-sm" onClick={upload} disabled={!file || uploading}>
            {uploading ? "Загружаем..." : "Загрузить презентацию"}
          </button>
        </div>
        <div className="muted small">
          Только PDF до ~4 МБ. Презентацию PowerPoint или Google Slides сохраните как PDF: «Файл → Сохранить как (Скачать) → PDF».
        </div>

        {presentations.length === 0 ? (
          <div className="muted small">Презентаций пока нет</div>
        ) : (
          presentations.map((p) => (
            <div key={p.id} className="row between" style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
              <div>
                <a href={`/api/learning/presentations/${p.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 800 }}>
                  {p.title}
                </a>
                <div className="muted small">
                  {p.description ? `${p.description} · ` : ""}
                  {(p.size / 1024 / 1024).toFixed(1)} МБ
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const t = prompt("Название презентации:", p.title);
                    if (t) act(() => send(`/api/learning/presentations/${p.id}`, "PATCH", { title: t }).then(loadPresentations), "Название изменено");
                  }}
                >
                  ✏️
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirm(`Удалить презентацию «${p.title}»?`))
                      act(() => send(`/api/learning/presentations/${p.id}`, "DELETE").then(loadPresentations), "Презентация удалена");
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card stack">
        <div className="row between">
          <h2 style={{ margin: 0 }}>🎮 Игры</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
            + Добавить вручную
          </button>
        </div>
        <div className="tabs" style={{ maxWidth: 760 }}>
          {(["TRUE_FALSE", "FLASHCARD", "FIX_ERROR"] as const).map((k) => (
            <button key={k} className={kind === k ? "active" : ""} onClick={() => { setKind(k); setEditing(null); }}>
              {KIND_LABEL[k]} ({(items ?? []).filter((i) => i.kind === k).length})
            </button>
          ))}
        </div>

        {editing === "new" && (
          <GameItemForm
            initial={emptyItem(kind)}
            onCancel={() => setEditing(null)}
            onSave={(v) => act(() => send("/api/learning/games", "POST", v).then(() => { setEditing(null); return loadItems(); }), "Добавлено")}
          />
        )}

        {!items ? (
          <div className="spinner" />
        ) : shown.length === 0 ? (
          <div className="muted small">Пока пусто. Нажмите «🎮 Создать игры» у документа в «Материалах» — ИИ создаст игры по темам, — или добавьте вручную.</div>
        ) : (
          shown.map((g) =>
            editing === g.id ? (
              <GameItemForm
                key={g.id}
                initial={g}
                onCancel={() => setEditing(null)}
                onSave={(v) => act(() => send(`/api/learning/games/${g.id}`, "PATCH", v).then(() => { setEditing(null); return loadItems(); }), "Сохранено")}
              />
            ) : (
              <div key={g.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                <div className="row between" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                  <div>
                    {g.kind === "TRUE_FALSE" && <span className="badge" style={{ marginRight: 6 }}>{g.isCorrect ? "✅ Можно" : "❌ Нельзя"}</span>}
                    {g.image && <img src={g.image} alt="" style={{ display: "block", maxHeight: 120, maxWidth: "100%", borderRadius: 8, marginBottom: 4 }} />}
                    <span style={{ fontWeight: 700 }}>{g.prompt}</span>
                    {g.kind !== "TRUE_FALSE" && <div className="small" style={{ marginTop: 4 }}>↪ {g.answer}</div>}
                    {g.explanation && <div className="muted small" style={{ marginTop: 4 }}>💡 {g.explanation}</div>}
                    {g.topic && <div className="muted small">Тема: {g.topic.name}</div>}
                  </div>
                  <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(g.id)}>
                      ✏️
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (confirm("Удалить этот элемент игры?")) act(() => send(`/api/learning/games/${g.id}`, "DELETE").then(loadItems), "Удалено");
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}

function GameItemForm({ initial, onSave, onCancel }: { initial: Partial<GameItem>; onSave: (v: object) => void; onCancel: () => void }) {
  const [v, setV] = useState({
    kind: initial.kind ?? "TRUE_FALSE",
    prompt: initial.prompt ?? "",
    answer: initial.answer ?? "",
    isCorrect: initial.isCorrect ?? true,
    explanation: initial.explanation ?? "",
    image: initial.image ?? "",
  });
  const tf = v.kind === "TRUE_FALSE";
  const fix = v.kind === "FIX_ERROR";
  return (
    <div className="card stack" style={{ background: "var(--surface-strong)" }}>
      {fix && <ImagePicker label="Скриншот чата с ошибкой (необязательно)" value={v.image} onChange={(image) => setV({ ...v, image })} />}
      <label className="field">
        {tf ? "Фраза сотрудника клиенту" : fix ? "Сообщение с ошибкой или задание (можно не заполнять, если есть скриншот)" : "Ситуация (лицевая сторона карточки)"}
        <textarea className="textarea" style={{ minHeight: 70 }} value={v.prompt} onChange={(e) => setV({ ...v, prompt: e.target.value })} />
      </label>
      {tf ? (
        <div className="row">
          <button className={`btn btn-sm ${v.isCorrect ? "btn-primary" : "btn-ghost"}`} onClick={() => setV({ ...v, isCorrect: true })}>
            ✅ Так говорить можно
          </button>
          <button className={`btn btn-sm ${!v.isCorrect ? "btn-danger" : "btn-ghost"}`} onClick={() => setV({ ...v, isCorrect: false })}>
            ❌ Так говорить нельзя
          </button>
        </div>
      ) : (
        <label className="field">
          {fix ? "Правильный вариант" : "Как правильно (обратная сторона)"}
          <textarea className="textarea" style={{ minHeight: 70 }} value={v.answer} onChange={(e) => setV({ ...v, answer: e.target.value })} />
        </label>
      )}
      <label className="field">
        Пояснение (почему)
        <input className="input" value={v.explanation} onChange={(e) => setV({ ...v, explanation: e.target.value })} />
      </label>
      <div className="row">
        <button className="btn btn-primary btn-sm" onClick={() => onSave(v)} disabled={!v.prompt.trim() && !(fix && v.image)}>
          Сохранить
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}
