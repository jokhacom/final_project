"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Doc = { id: string; title: string; fileName: string | null; chars: number; preview: string; createdAt: string };

// Файлы «Помощника ответов»: шаблоны, примеры ответов, правила. По ним ИИ составляет ответ клиенту.
// Кому доступен помощник — отметка «⭐ Премиум» у сотрудника на «Обзоре».
export default function AdminAssistantPage() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [total, setTotal] = useState({ chars: 0, max: 0 });
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    fetch("/api/assistant/docs").then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setError(d.error ?? "Не удалось загрузить");
      setDocs(d.items);
      setTotal({ chars: d.totalChars, max: d.maxChars });
    });

  useEffect(() => {
    load();
  }, []);

  async function add() {
    setSaving(true);
    setMsg(null);
    const form = new FormData();
    if (file) form.append("file", file);
    form.append("text", text);
    form.append("title", title);
    const res = await fetch("/api/assistant/docs", { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error ?? `Ошибка ${res.status}` });
    setMsg({ ok: true, text: `Добавлено: «${d.item.title}»` });
    setFile(null);
    setFileKey((k) => k + 1);
    setTitle("");
    setText("");
    load();
  }

  async function remove(d: Doc) {
    if (!confirm(`Удалить «${d.title}»? Помощник перестанет на него опираться.`)) return;
    await fetch(`/api/assistant/docs/${d.id}`, { method: "DELETE" });
    load();
  }

  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div className="stack">
      <h1>🤖 Помощник ответов</h1>
      <p className="muted small" style={{ marginTop: -8 }}>
        Загрузите шаблоны, примеры ответов и правила. Сотрудник вставляет сообщение клиента — ИИ составляет готовый ответ только по этим файлам: на русском, на
        узбекском и на узбекском новым алфавитом. Доступ даёте вы: «Обзор» → «Сотрудники» → ⭐ Премиум. Администраторам помощник доступен всегда.{" "}
        <Link href="/assistant">Открыть помощник →</Link>
      </p>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Добавить</h2>
        <input className="input" placeholder="Название (необязательно), например «Шаблоны: возврат денег»" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="row" style={{ gap: 10 }}>
          <input key={fileKey} type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <span className="muted small">PDF, DOCX или TXT — или вставьте текст ниже</span>
        </div>
        {!file && (
          <textarea
            className="textarea"
            rows={6}
            placeholder={"Например:\nВопрос: Когда вернут деньги?\nОтвет: Здравствуйте! Деньги вернутся на карту в течение 3 рабочих дней…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={saving || (!file && !text.trim())} onClick={add}>
          {saving ? "Сохраняю…" : "Добавить"}
        </button>
        {msg && <div className={`alert ${msg.ok ? "alert-success" : "alert-error"}`}>{msg.text}</div>}
      </div>

      <div className="card">
        <h2>Файлы ({docs?.length ?? 0})</h2>
        {docs && total.max > 0 && (
          <p className="muted small" style={{ marginTop: -8 }}>
            Объём: {total.chars.toLocaleString("ru-RU")} символов из {total.max.toLocaleString("ru-RU")}. Всё отправляется ИИ с каждым вопросом, поэтому лишнее лучше
            удалять.
            {total.chars > total.max && <strong> Лимит превышен — последние файлы ИИ не увидит.</strong>}
          </p>
        )}
        {!docs ? (
          <div className="spinner" />
        ) : docs.length === 0 ? (
          <p className="muted small">Пока ничего не загружено</p>
        ) : (
          docs.map((d) => (
            <div key={d.id} className="row between" style={{ padding: "10px 0", borderTop: "1px solid var(--border)", flexWrap: "nowrap", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{d.title}</div>
                <div className="muted small">
                  {d.fileName ?? "Текст"} · {d.chars.toLocaleString("ru-RU")} символов · {new Date(d.createdAt).toLocaleDateString("ru-RU")}
                </div>
                <div className="muted small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {d.preview}
                </div>
              </div>
              <button className="btn btn-danger btn-sm" style={{ flex: "none" }} onClick={() => remove(d)}>
                Удалить
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
