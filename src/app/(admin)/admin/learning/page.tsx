"use client";

import { useEffect, useState } from "react";
import { upload as uploadToBlob } from "@vercel/blob/client";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { LANGUAGE_ROUND, LANGUAGE_SECONDS } from "@/lib/gameConstants";
import { MAX_PRESENTATION_MB, PRESENTATION_TYPES, extOf, viewerUrl } from "@/lib/presentations";

type Presentation = { id: string; title: string; description: string | null; fileName: string; url: string | null; size: number; order: number; createdAt: string };
type GameItem = {
  id: string;
  kind: "TRUE_FALSE" | "FIX_ERROR" | "LANGUAGE";
  prompt: string;
  answer: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
  image: string | null;
  options: string[] | null;
  correctIndex: number | null;
  language: "ru" | "uz" | null;
  category: string | null;
  topic: { name: string } | null;
};

const KIND_LABEL = { TRUE_FALSE: "«Можно или нельзя?»", FIX_ERROR: "«Найди и исправь ошибку»", LANGUAGE: "«Грамотность»" };
const LANG_LABEL = { ru: "🇷🇺 Русский", uz: "🇺🇿 Oʻzbek tili" };
const emptyItem = (kind: GameItem["kind"], language: "ru" | "uz"): Partial<GameItem> => ({
  kind,
  prompt: kind === "LANGUAGE" ? (language === "ru" ? "Как правильно?" : "Qaysi biri toʻgʻri yozilgan?") : "",
  answer: "",
  isCorrect: true,
  explanation: "",
  image: null,
  options: ["", ""],
  correctIndex: 0,
  language,
  category: "",
});

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
  const [lang, setLang] = useState<"ru" | "uz">("ru");
  const [aiCount, setAiCount] = useState("10");
  const [working, setWorking] = useState(false);
  const [aiOn, setAiOn] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [blob, setBlob] = useState(false); // подключено хранилище файлов — можно PowerPoint и большие файлы
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadPresentations = () => fetch("/api/learning/presentations").then((r) => r.json()).then((d) => {
      setPresentations(d.items ?? []);
      setBlob(!!d.blob);
    });
  const loadItems = () => fetch("/api/learning/games?all=1").then((r) => r.json()).then((d) => setItems(d.items ?? []));

  useEffect(() => {
    loadPresentations();
    loadItems();
    fetch("/api/admin/status").then((r) => r.json()).then((d) => setAiOn(!!d.ai?.configured)).catch(() => {});
  }, []);

  async function languageAction(action: "starter" | "generate") {
    setWorking(true);
    await act(async () => {
      const r = await send("/api/learning/games/language", "POST", { action, language: lang, count: Number(aiCount) || 10 });
      await loadItems();
      if (!r.created) throw new Error(action === "starter" ? "Все готовые вопросы уже добавлены" : "ИИ не создал новых вопросов — попробуйте ещё раз");
      return r;
    }, action === "starter" ? "Готовые вопросы добавлены" : "Вопросы созданы — проверьте их и поправьте, если нужно");
    setWorking(false);
  }

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
      let res: Response;
      if (blob) {
        // Файл идёт из браузера прямо в хранилище — без лимита запроса Vercel в 4,5 МБ.
        if (!PRESENTATION_TYPES[extOf(file.name)]) throw new Error("Нужен PDF или PowerPoint (.pptx, .ppt)");
        if (file.size > MAX_PRESENTATION_MB * 1024 * 1024) throw new Error(`Файл больше ${MAX_PRESENTATION_MB} МБ`);
        setProgress(0);
        const stored = await uploadToBlob(`presentations/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/learning/presentations/upload",
          contentType: PRESENTATION_TYPES[extOf(file.name)],
          multipart: file.size > 10 * 1024 * 1024,
          onUploadProgress: (p) => setProgress(Math.round(p.percentage)),
        });
        res = await fetch("/api/learning/presentations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: stored.url, fileName: file.name, size: file.size, title, description }),
        });
      } else {
        const form = new FormData();
        form.append("file", file);
        form.append("title", title);
        form.append("description", description);
        res = await fetch("/api/learning/presentations", { method: "POST", body: form });
      }
      if (res.status === 413) throw new Error("Файл слишком большой (лимит около 4 МБ) — подключите хранилище файлов или сожмите PDF");
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

  const shown = (items ?? []).filter((i) => i.kind === kind && (kind !== "LANGUAGE" || i.language === lang));

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
          <input key={fileKey} type="file" accept={blob ? ".pdf,.pptx,.ppt" : ".pdf,application/pdf"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button className="btn btn-primary btn-sm" onClick={upload} disabled={!file || uploading}>
            {uploading ? (blob ? `Загружаем... ${progress}%` : "Загружаем...") : "Загрузить презентацию"}
          </button>
        </div>
        <div className="muted small">
          {blob
            ? `PDF или PowerPoint (.pptx, .ppt) до ${MAX_PRESENTATION_MB} МБ. PowerPoint сотрудники смотрят прямо на сайте (через просмотрщик Microsoft).`
            : "Сейчас — только PDF до ~4 МБ. Чтобы загружать PowerPoint и файлы больше, подключите хранилище файлов: Vercel → проект → Storage → Create → Blob → Connect (см. README)."}
        </div>

        {presentations.length === 0 ? (
          <div className="muted small">Презентаций пока нет</div>
        ) : (
          presentations.map((p) => (
            <div key={p.id} className="row between" style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
              <div>
                <a href={viewerUrl(p)} target="_blank" rel="noreferrer" style={{ fontWeight: 800 }}>
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
          {(["TRUE_FALSE", "FIX_ERROR", "LANGUAGE"] as const).map((k) => (
            <button key={k} className={kind === k ? "active" : ""} onClick={() => { setKind(k); setEditing(null); }}>
              {KIND_LABEL[k]} ({(items ?? []).filter((i) => i.kind === k).length})
            </button>
          ))}
        </div>

        {kind === "LANGUAGE" && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="tabs" style={{ maxWidth: 360 }}>
              {(["ru", "uz"] as const).map((l) => (
                <button key={l} className={lang === l ? "active" : ""} onClick={() => { setLang(l); setEditing(null); }}>
                  {LANG_LABEL[l]} ({(items ?? []).filter((i) => i.kind === "LANGUAGE" && i.language === l).length})
                </button>
              ))}
            </div>
            <div className="row">
              <button className="btn btn-ghost btn-sm" disabled={working} onClick={() => languageAction("starter")}>
                📚 Добавить готовые вопросы
              </button>
              {aiOn && (
                <>
                  <input className="input" style={{ width: 70 }} inputMode="numeric" value={aiCount} onChange={(e) => setAiCount(e.target.value.replace(/\D/g, ""))} />
                  <button className="btn btn-ghost btn-sm" disabled={working || !Number(aiCount)} onClick={() => languageAction("generate")}>
                    {working ? "Создаём..." : "🤖 Создать ИИ"}
                  </button>
                </>
              )}
            </div>
            <div className="muted small">
              Русский и узбекский — отдельные раунды по {LANGUAGE_ROUND} вопросов, {LANGUAGE_SECONDS} секунд на вопрос. Готовые вопросы можно добавить один раз — повторно не дублируются.
              {lang === "uz" && " Узбекские — по правилам орфографии (imlo.uz): oʻ, gʻ, tutuq belgisi ʼ."}
            </div>
          </div>
        )}

        {editing === "new" && (
          <GameItemForm
            initial={emptyItem(kind, lang)}
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
                    {g.kind === "LANGUAGE" && g.category && <span className="badge" style={{ marginRight: 6 }}>{g.category}</span>}
                    {g.image && <img src={g.image} alt="" style={{ display: "block", maxHeight: 120, maxWidth: "100%", borderRadius: 8, marginBottom: 4 }} />}
                    <span style={{ fontWeight: 700 }}>{g.prompt}</span>
                    {g.kind === "FIX_ERROR" && <div className="small" style={{ marginTop: 4 }}>↪ {g.answer}</div>}
                    {g.kind === "LANGUAGE" && (
                      <div className="small" style={{ marginTop: 4 }}>
                        {(g.options ?? []).map((o, k) => (
                          <span key={k} style={{ marginRight: 12, fontWeight: k === g.correctIndex ? 800 : 400 }}>
                            {k === g.correctIndex ? "✅" : "▫️"} {o}
                          </span>
                        ))}
                      </div>
                    )}
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

// Пустые варианты убираем, номер правильного пересчитываем.
function compactOptions<T extends { options: string[]; correctIndex: number }>(v: T): T {
  const kept = v.options.map((o, k) => ({ o: o.trim(), k })).filter((x) => x.o);
  return { ...v, options: kept.map((x) => x.o), correctIndex: Math.max(0, kept.findIndex((x) => x.k === v.correctIndex)) };
}

function GameItemForm({ initial, onSave, onCancel }: { initial: Partial<GameItem>; onSave: (v: object) => void; onCancel: () => void }) {
  const [v, setV] = useState({
    kind: initial.kind ?? "TRUE_FALSE",
    prompt: initial.prompt ?? "",
    answer: initial.answer ?? "",
    isCorrect: initial.isCorrect ?? true,
    explanation: initial.explanation ?? "",
    image: initial.image ?? "",
    options: initial.options?.length ? initial.options : ["", ""],
    correctIndex: initial.correctIndex ?? 0,
    language: initial.language ?? "ru",
    category: initial.category ?? "",
  });
  const tf = v.kind === "TRUE_FALSE";
  const fix = v.kind === "FIX_ERROR";
  const lang = v.kind === "LANGUAGE";
  const setOption = (k: number, text: string) => setV({ ...v, options: v.options.map((o, j) => (j === k ? text : o)) });
  const removeOption = (k: number) =>
    setV({ ...v, options: v.options.filter((_, j) => j !== k), correctIndex: k === v.correctIndex ? 0 : k < v.correctIndex ? v.correctIndex - 1 : v.correctIndex });
  const canSave = lang ? v.prompt.trim() && v.options.filter((o) => o.trim()).length >= 2 && v.options[v.correctIndex]?.trim() : v.prompt.trim() || (fix && v.image);

  return (
    <div className="card stack" style={{ background: "var(--surface-strong)" }}>
      {fix && <ImagePicker label="Скриншот чата с ошибкой (необязательно)" value={v.image} onChange={(image) => setV({ ...v, image })} />}
      {lang && (
        <div className="grid grid-2">
          <label className="field">
            Язык
            <select className="input" value={v.language} onChange={(e) => setV({ ...v, language: e.target.value as "ru" | "uz" })}>
              <option value="ru">Русский</option>
              <option value="uz">Oʻzbek tili</option>
            </select>
          </label>
          <label className="field">
            Раздел (например: Предлоги, Суффиксы)
            <input className="input" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} />
          </label>
        </div>
      )}
      <label className="field">
        {tf ? "Фраза сотрудника клиенту" : fix ? "Сообщение с ошибкой или задание (можно не заполнять, если есть скриншот)" : "Вопрос (коротко — на ответ 10 секунд)"}
        <textarea className="textarea" style={{ minHeight: lang ? 50 : 70 }} value={v.prompt} onChange={(e) => setV({ ...v, prompt: e.target.value })} />
      </label>
      {tf && (
        <div className="row">
          <button className={`btn btn-sm ${v.isCorrect ? "btn-primary" : "btn-ghost"}`} onClick={() => setV({ ...v, isCorrect: true })}>
            ✅ Так говорить можно
          </button>
          <button className={`btn btn-sm ${!v.isCorrect ? "btn-danger" : "btn-ghost"}`} onClick={() => setV({ ...v, isCorrect: false })}>
            ❌ Так говорить нельзя
          </button>
        </div>
      )}
      {fix && (
        <label className="field">
          Правильный вариант
          <textarea className="textarea" style={{ minHeight: 70 }} value={v.answer} onChange={(e) => setV({ ...v, answer: e.target.value })} />
        </label>
      )}
      {lang && (
        <div className="field">
          <span>Варианты ответа (отметьте правильный; в игре порядок перемешивается)</span>
          {v.options.map((o, k) => (
            <div key={k} className="row" style={{ flexWrap: "nowrap" }}>
              <input type="radio" name="correct" checked={v.correctIndex === k} onChange={() => setV({ ...v, correctIndex: k })} />
              <input className="input" value={o} onChange={(e) => setOption(k, e.target.value)} placeholder={`Вариант ${k + 1}`} />
              {v.options.length > 2 && (
                <button className="btn btn-ghost btn-sm" onClick={() => removeOption(k)}>
                  ✕
                </button>
              )}
            </div>
          ))}
          {v.options.length < 4 && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setV({ ...v, options: [...v.options, ""] })}>
              + Вариант
            </button>
          )}
        </div>
      )}
      <label className="field">
        Пояснение (почему)
        <input className="input" value={v.explanation} onChange={(e) => setV({ ...v, explanation: e.target.value })} />
      </label>
      <div className="row">
        <button className="btn btn-primary btn-sm" onClick={() => onSave(lang ? compactOptions(v) : v)} disabled={!canSave}>
          Сохранить
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}
