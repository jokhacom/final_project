"use client";

import { useEffect, useState } from "react";

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

type Rule = { id: string; type: string; text: string; sourceQuote?: string | null };
type Topic = { id: string; name: string; description?: string | null; rules: Rule[] };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Загружен",
  ANALYZING: "ИИ читает документ...",
  PROCESSED: "База знаний готова",
  FAILED: "Ошибка",
};

// Раздел 2, 13, 14, 21 запроса: Super Admin загружает документ → жмёт
// "Анализировать" → ИИ строит базу знаний (темы + правила) → админ видит
// её и может по каждой теме сгенерировать вопросы. Полная трассировка
// видна прямо здесь: документ → тема → правило → вопросы.
export default function MaterialsAdminPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [generatingTopicId, setGeneratingTopicId] = useState<string | null>(null);
  const [topicsByMaterial, setTopicsByMaterial] = useState<Record<string, Topic[]>>({});
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadMaterials() {
    const res = await fetch("/api/materials/upload");
    const data = await res.json();
    setMaterials(data.materials ?? []);
  }

  useEffect(() => {
    loadMaterials();
  }, []);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title || file.name);
      // TODO: подставлять реального userId суперадминистратора из сессии
      formData.append("uploadedBy", "superadmin");

      const res = await fetch("/api/materials/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");

      setFile(null);
      setTitle("");
      await loadMaterials();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze(materialId: string) {
    setAnalyzingId(materialId);
    setError(null);
    try {
      const res = await fetch(`/api/materials/${materialId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка анализа");

      setTopicsByMaterial((prev) => ({ ...prev, [materialId]: data.topics }));
      setExpandedMaterial(materialId);
      await loadMaterials();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setAnalyzingId(null);
    }
  }

  async function toggleExpand(materialId: string) {
    if (expandedMaterial === materialId) {
      setExpandedMaterial(null);
      return;
    }
    if (!topicsByMaterial[materialId]) {
      const res = await fetch(`/api/materials/${materialId}/knowledge`);
      const data = await res.json();
      setTopicsByMaterial((prev) => ({ ...prev, [materialId]: data.topics }));
    }
    setExpandedMaterial(materialId);
  }

  async function handleGenerateForTopic(topicId: string, level: string) {
    setGeneratingTopicId(topicId);
    setError(null);
    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, level, count: 10 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка генерации");
      alert(`Создано вопросов: ${data.questions.length}`);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setGeneratingTopicId(null);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>База знаний — материалы</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Загрузите PDF/DOCX/TXT (Red Policy, Tone of Voice и т.д.) → нажмите «Анализировать» — ИИ прочитает
        документ, выделит темы и правила → по каждой теме можно сгенерировать вопросы.
      </p>

      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Название материала (необязательно)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ marginBottom: 8, display: "block" }}
        />
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#7C4DFF", color: "white", cursor: file ? "pointer" : "not-allowed" }}
        >
          {uploading ? "Загрузка..." : "Загрузить"}
        </button>
        {error && <div style={{ color: "crimson", marginTop: 8, fontSize: 13 }}>{error}</div>}
      </div>

      {materials.map((m) => (
        <div key={m.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, marginBottom: 12, opacity: m.isActive ? 1 : 0.5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700 }}>
                {m.title} {m.version > 1 && <span style={{ fontSize: 11, color: "#7C4DFF" }}>v{m.version}</span>}
                {!m.isActive && <span style={{ fontSize: 11, color: "#999" }}> (заменён новой версией)</span>}
              </div>
              <div style={{ fontSize: 12, color: "#888" }}>
                {m.type.toUpperCase()} · {STATUS_LABEL[m.status]} · вопросов: {m._count.questions}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {m.status !== "ANALYZING" && (
                <button
                  onClick={() => handleAnalyze(m.id)}
                  disabled={analyzingId === m.id}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #7C4DFF", background: "white", color: "#7C4DFF", fontSize: 12, cursor: "pointer" }}
                >
                  {analyzingId === m.id ? "Анализирую..." : m.status === "PROCESSED" ? "Переанализировать" : "Анализировать"}
                </button>
              )}
              {m.status === "PROCESSED" && (
                <button onClick={() => toggleExpand(m.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc", background: "white", fontSize: 12, cursor: "pointer" }}>
                  {expandedMaterial === m.id ? "Скрыть" : "Открыть базу знаний"}
                </button>
              )}
            </div>
          </div>

          {expandedMaterial === m.id && topicsByMaterial[m.id] && (
            <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
              {topicsByMaterial[m.id].map((topic) => (
                <div key={topic.id} style={{ marginBottom: 14, paddingLeft: 8, borderLeft: "3px solid #7C4DFF" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{topic.name}</div>
                  {topic.description && <div style={{ fontSize: 12, color: "#777", marginBottom: 4 }}>{topic.description}</div>}
                  {topic.rules.map((r) => (
                    <div key={r.id} style={{ fontSize: 12, marginTop: 4, color: "#444" }}>
                      <strong>[{r.type}]</strong> {r.text}
                      {r.sourceQuote && <div style={{ color: "#999", fontStyle: "italic" }}>«{r.sourceQuote}»</div>}
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {["BEGINNER", "MIDDLE", "PROFESSIONAL"].map((level) => (
                      <button
                        key={level}
                        onClick={() => handleGenerateForTopic(topic.id, level)}
                        disabled={generatingTopicId === topic.id}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #00E5A0", background: "white", color: "#00A876", fontSize: 11, cursor: "pointer" }}
                      >
                        {generatingTopicId === topic.id ? "..." : `+ вопросы ${level}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
