"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useAdminStatus } from "@/components/admin/useAdminStatus";
import { AiOffNotice } from "@/components/admin/AiOffNotice";

type Material = {
  id: string;
  title: string;
  type: string;
  status: "PENDING" | "ANALYZING" | "PROCESSED" | "FAILED";
  version: number;
  isActive: boolean;
  createdAt: string;
  _count: { questions: number };
};

type Rule = { id: string; type: string; text: string; sourceQuote?: string | null; questions: { id: string }[] };
type Topic = { id: string; name: string; description?: string | null; rules: Rule[]; questions: { id: string }[] };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Загружен, ждёт анализа",
  ANALYZING: "ИИ читает документ...",
  PROCESSED: "База знаний готова",
  FAILED: "Ошибка",
};

const RULE_LABEL: Record<string, string> = {
  REQUIRED: "✅ Обязательно",
  FORBIDDEN: "⛔ Запрещено",
  RECOMMENDED: "👍 Рекомендуется",
  EXAMPLE_GOOD: "🟢 Хороший пример",
  EXAMPLE_BAD: "🔴 Плохой пример",
};

const LEVELS = [
  { id: "BEGINNER", label: "Новичок" },
  { id: "MIDDLE", label: "Middle" },
  { id: "PROFESSIONAL", label: "Professional" },
];

// Документ → «Анализировать» (ИИ строит темы и правила) → по каждой теме
// генерация вопросов нужного уровня. Цепочка документ → тема → правило → вопросы видна здесь же.
export default function MaterialsAdminPage() {
  const { data: session } = useSession();
  const isSuper = (session?.user as any)?.role === "SUPERADMIN";
  const status = useAdminStatus();
  const aiOn = !!status?.ai.configured;
  const [materials, setMaterials] = useState<Material[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [replaceId, setReplaceId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [topicsByMaterial, setTopicsByMaterial] = useState<Record<string, Topic[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadMaterials() {
    const res = await fetch("/api/materials/upload");
    const data = await res.json();
    setMaterials(data.materials ?? []);
  }

  async function loadTopics(materialId: string) {
    const res = await fetch(`/api/materials/${materialId}/knowledge`);
    const data = await res.json();
    setTopicsByMaterial((prev) => ({ ...prev, [materialId]: data.topics ?? [] }));
  }

  useEffect(() => {
    loadMaterials();
  }, []);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const handleUpload = () =>
    run("upload", async () => {
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title || file.name);
      if (replaceId) formData.append("replaceMaterialId", replaceId);
      const res = await fetch("/api/materials/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
      setFile(null);
      setTitle("");
      setReplaceId("");
      setNotice(aiOn ? "Документ загружен. Теперь нажмите «Анализировать»." : "Документ загружен. Анализ станет доступен после подключения ИИ.");
      await loadMaterials();
    });

  const handleAnalyze = (materialId: string) =>
    run(`analyze:${materialId}`, async () => {
      const res = await fetch(`/api/materials/${materialId}/analyze`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      await loadMaterials();
      if (!res.ok) throw new Error(data.error ?? "Ошибка анализа");
      await loadTopics(materialId);
      setExpanded(materialId);
    });

  const toggleExpand = async (materialId: string) => {
    if (expanded === materialId) return setExpanded(null);
    if (!topicsByMaterial[materialId]) await loadTopics(materialId);
    setExpanded(materialId);
  };

  const generate = (materialId: string, payload: Record<string, string>, level: string, key: string) =>
    run(key, async () => {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId, ...payload, level, count: 10 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Ошибка генерации");
      setNotice(`Создано вопросов: ${data.questions.length}. Проверить и поправить их можно в разделе «Вопросы».`);
      await Promise.all([loadMaterials(), loadTopics(materialId)]);
    });

  return (
    <div className="stack">
      <div>
        <h1>База знаний — материалы</h1>
        <p className="muted small">
          Загрузите PDF/DOCX/TXT (Редполитика, Tone of Voice и т.д.) → «Анализировать»: ИИ выделит темы и правила → по каждой теме сгенерируйте
          вопросы нужного уровня. Загрузить документы можно уже сейчас — анализ запустите, когда подключите ИИ.
        </p>
      </div>

      {status && <AiOffNotice ai={status.ai} />}

      {isSuper && (
        <div className="card stack">
          <h2>Загрузить документ</h2>
          <input className="input" placeholder="Название (необязательно)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <label className="field">
            Это новая версия существующего документа?
            <select className="select" value={replaceId} onChange={(e) => setReplaceId(e.target.value)}>
              <option value="">Нет, это новый документ</option>
              {materials
                .filter((m) => m.isActive)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    Заменить «{m.title}» (v{m.version})
                  </option>
                ))}
            </select>
          </label>
          <div>
            <button className="btn btn-primary" onClick={handleUpload} disabled={!file || busy === "upload"}>
              {busy === "upload" ? "Загрузка..." : "Загрузить"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {materials.length === 0 && <div className="card muted center">Материалов пока нет</div>}

      {materials.map((m) => (
        <div key={m.id} className="card" style={{ opacity: m.isActive ? 1 : 0.55 }}>
          <div className="row between">
            <div>
              <div style={{ fontWeight: 900 }}>
                {m.title} <span className="badge">v{m.version}</span>
                {!m.isActive && <span className="muted small"> (заменён новой версией)</span>}
              </div>
              <div className="muted small">
                {m.type.toUpperCase()} · {STATUS_LABEL[m.status]} · вопросов: {m._count.questions}
              </div>
            </div>
            <div className="row">
              {isSuper && m.isActive && aiOn && (
                <button className="btn btn-ghost btn-sm" onClick={() => handleAnalyze(m.id)} disabled={!!busy || m.status === "ANALYZING"}>
                  {busy === `analyze:${m.id}` ? "ИИ анализирует..." : m.status === "PROCESSED" ? "Переанализировать" : "Анализировать"}
                </button>
              )}
              {m.status === "PROCESSED" && (
                <button className="btn btn-ghost btn-sm" onClick={() => toggleExpand(m.id)}>
                  {expanded === m.id ? "Скрыть" : "База знаний"}
                </button>
              )}
            </div>
          </div>

          {isSuper && aiOn && m.isActive && m.status !== "PROCESSED" && m.status !== "ANALYZING" && (
            <div className="row mt small">
              <span className="muted">Или сразу вопросы по всему документу:</span>
              {LEVELS.map((l) => (
                <button key={l.id} className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => generate(m.id, {}, l.id, `doc:${m.id}:${l.id}`)}>
                  {busy === `doc:${m.id}:${l.id}` ? "..." : `+ ${l.label}`}
                </button>
              ))}
            </div>
          )}

          {expanded === m.id && topicsByMaterial[m.id] && (
            <div className="stack mt" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              {topicsByMaterial[m.id].length === 0 && <div className="muted small">ИИ не нашёл тем в документе</div>}
              {topicsByMaterial[m.id].map((topic) => (
                <div key={topic.id} style={{ paddingLeft: 12, borderLeft: "4px solid var(--accent)" }}>
                  <div style={{ fontWeight: 900 }}>
                    {topic.name} <span className="badge">вопросов: {topic.questions.length}</span>
                  </div>
                  {topic.description && <div className="muted small">{topic.description}</div>}
                  <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                    {topic.rules.map((r) => (
                      <div key={r.id} className="small">
                        <strong>{RULE_LABEL[r.type] ?? r.type}:</strong> {r.text}
                        {r.sourceQuote && <div className="muted" style={{ fontStyle: "italic" }}>«{r.sourceQuote}»</div>}
                      </div>
                    ))}
                  </div>
                  {isSuper && aiOn && m.isActive && (
                    <div className="row" style={{ marginTop: 8 }}>
                      {LEVELS.map((l) => (
                        <button
                          key={l.id}
                          className="btn btn-ghost btn-sm"
                          disabled={!!busy}
                          onClick={() => generate(m.id, { topicId: topic.id }, l.id, `topic:${topic.id}:${l.id}`)}
                        >
                          {busy === `topic:${topic.id}:${l.id}` ? "Генерируем..." : `+ вопросы ${l.label}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
