"use client";

import { useEffect, useRef, useState } from "react";
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
  chars: number;
  chunks: number;
  _count: { questions: number; topics: number };
};

type Rule = { id: string; type: string; text: string; sourceQuote?: string | null; questions: { id: string }[] };
type Topic = {
  id: string;
  name: string;
  description?: string | null;
  rules: Rule[];
  questions: { id: string; level: string }[];
  _count: { gameItems: number };
};

type Progress = { materialId: string; stage: string; done: number; total: number; log: string[] };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Загружен, ждёт анализа",
  ANALYZING: "Анализ не завершён",
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
  { id: "EXAM", label: "Экзамен" },
];

// Сколько вопросов на тему создаёт ИИ для уровня: с вариантами и открытых. Новичку по умолчанию больше простых с вариантами.
type Mix = { choice: string; open: string };
const DEFAULT_MIX: Record<string, Mix> = {
  BEGINNER: { choice: "3", open: "1" },
  MIDDLE: { choice: "2", open: "2" },
  PROFESSIONAL: { choice: "1", open: "3" },
  EXAM: { choice: "2", open: "2" },
};
const toNum = (v: string) => Math.max(0, Math.min(30, Math.round(Number(v)) || 0));

// Порции по 10 для одного запроса к ИИ, с сохранением нужного числа каждого вида.
function mixBatches(choice: number, open: number) {
  const out: { choiceCount: number; openCount: number }[] = [];
  while (choice > 0 || open > 0) {
    const c = Math.min(choice, BATCH);
    const o = Math.min(open, BATCH - c);
    out.push({ choiceCount: c, openCount: o });
    choice -= c;
    open -= o;
  }
  return out;
}

// Примерно 2000 символов — одна страница текста.
const pages = (chars: number) => Math.max(1, Math.round(chars / 2000));

async function post(url: string, body: object) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Ошибка ${res.status}`);
  return data;
}

// Большое число вопросов/игр на тему запрашиваем у ИИ порциями по 10.
const BATCH = 10;
const batches = (n: number) => Array.from({ length: Math.ceil(n / BATCH) }, (_, i) => Math.min(BATCH, n - i * BATCH));

// Один шаг с повтором: ИИ иногда отвечает с ошибкой, второй попытки обычно хватает.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, 3000));
    return fn();
  }
}

// Документ → ИИ читает его по частям и строит темы и правила → по каждой теме
// создаются вопросы трёх уровней. Всё это делает кнопка «Создать тесты»; по шагам
// то же самое доступно кнопками «Анализировать» и «+ вопросы» у каждой темы.
export default function MaterialsAdminPage() {
  const { data: session } = useSession();
  const isSuper = (session?.user as any)?.role === "SUPERADMIN";
  const status = useAdminStatus();
  const aiOn = !!status?.ai.configured;
  const [materials, setMaterials] = useState<Material[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0); // смена key сбрасывает выбранный файл в поле
  const [title, setTitle] = useState("");
  const [replaceId, setReplaceId] = useState("");
  // По умолчанию выключено: тесты создаются только по команде («🤖 Создать тесты» или «+» у темы).
  const [autoCreate, setAutoCreate] = useState(false);
  // Поля храним строкой, чтобы цифру можно было стереть и набрать заново (иначе
  // пустое поле сразу превращалось в «1», и «2» набиралось как «12»).
  const [mix, setMix] = useState<Record<string, Mix>>(DEFAULT_MIX);
  const [gamesPerTopicText, setGamesPerTopicText] = useState("3");
  // 0 — этот вид не создаётся.
  const levelTotal = (level: string) => toNum(mix[level].choice) + toNum(mix[level].open);
  // Сохраняем настройку на сервере — она общая и не теряется после перезагрузки.
  const saveMix = (level: string, kind: keyof Mix, value: string) =>
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: `gen_${kind}_${level}`, value: String(toNum(value)) }),
    });
  const gamesPerTopic = Math.max(0, Math.round(Number(gamesPerTopicText)) || 0);
  const [language, setLanguage] = useState<"auto" | "ru" | "uz">("auto");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [topicsByMaterial, setTopicsByMaterial] = useState<Record<string, Topic[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const stopRef = useRef(false);

  async function loadMaterials(): Promise<Material[]> {
    const res = await fetch("/api/materials/upload");
    const data = await res.json();
    setMaterials(data.materials ?? []);
    return data.materials ?? [];
  }

  async function loadTopics(materialId: string): Promise<Topic[]> {
    const res = await fetch(`/api/materials/${materialId}/knowledge`);
    const data = await res.json();
    setTopicsByMaterial((prev) => ({ ...prev, [materialId]: data.topics ?? [] }));
    return data.topics ?? [];
  }

  useEffect(() => {
    loadMaterials();
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const saved = new Map<string, string>((d.settings ?? []).map((x: { key: string; value: string }) => [x.key, x.value]));
        setMix(
          Object.fromEntries(
            LEVELS.map((l) => [l.id, { choice: saved.get(`gen_choice_${l.id}`) ?? DEFAULT_MIX[l.id].choice, open: saved.get(`gen_open_${l.id}`) ?? DEFAULT_MIX[l.id].open }])
          )
        );
      })
      .catch(() => {});
  }, []);

  // Пока идёт долгая обработка — предупреждаем, если пытаются закрыть вкладку.
  useEffect(() => {
    if (!progress) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [progress]);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    stopRef.current = false;
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setProgress(null);
      loadMaterials();
    }
  }

  const step = (p: Partial<Progress> & { materialId: string }, line?: string) =>
    setProgress((prev) => {
      const base = prev && prev.materialId === p.materialId ? prev : { materialId: p.materialId, stage: "", done: 0, total: 1, log: [] };
      return { ...base, ...p, log: line ? [...base.log, line].slice(-6) : base.log };
    });

  // Анализ всего документа по частям. Возвращает число тем.
  async function analyzeAll(m: Pick<Material, "id" | "chunks">) {
    let total = m.chunks;
    let skipped = 0;
    for (let i = 0; i < total; i++) {
      if (stopRef.current) throw new Error("Остановлено");
      step({ materialId: m.id, stage: `ИИ читает документ: часть ${i + 1} из ${total}`, done: i, total });
      try {
        const r = await withRetry(() => post(`/api/materials/${m.id}/analyze`, { chunk: i }));
        total = r.chunkCount;
        step({ materialId: m.id, total }, `Часть ${i + 1}: новых тем ${r.topicsAdded}, правил ${r.rulesAdded}`);
      } catch (e) {
        if (i === 0) throw e; // без первой части анализ не начался — дальше смысла нет
        skipped++;
        step({ materialId: m.id }, `⚠️ Часть ${i + 1} пропущена: ${e instanceof Error ? e.message : e}`);
      }
    }
    const fin = await post(`/api/materials/${m.id}/analyze`, { finalize: true });
    if (!fin.topics) throw new Error("ИИ не нашёл в документе тем и правил");
    return { topics: fin.topics as number, skipped };
  }

  // Вопросы по всем темам для трёх уровней. Темы, где вопросы этого уровня уже есть, пропускаются.
  // Итоговый экзамен — отдельное задание: его вопросы создаются только по кнопке «+ Экзамен» у темы.
  async function generateAll(materialId: string) {
    const topics = await loadTopics(materialId);
    const jobs = topics.flatMap((t) =>
      LEVELS.filter((l) => l.id !== "EXAM" && levelTotal(l.id) > 0 && !t.questions.some((q) => q.level === l.id)).map((l) => ({ topic: t, level: l }))
    );
    let created = 0;
    let failed = 0;
    for (let i = 0; i < jobs.length; i++) {
      if (stopRef.current) throw new Error(`Остановлено. Создано вопросов: ${created}`);
      const { topic, level } = jobs[i];
      step({ materialId, stage: `Создаём вопросы: ${i + 1} из ${jobs.length} — «${topic.name}», ${level.label}`, done: i, total: jobs.length });
      try {
        for (const part of mixBatches(toNum(mix[level.id].choice), toNum(mix[level.id].open))) {
          const r = await withRetry(() => post("/api/questions/generate", { topicId: topic.id, level: level.id, ...part, language }));
          created += r.questions.length;
        }
      } catch (e) {
        failed++;
        step({ materialId }, `⚠️ «${topic.name}» (${level.label}) пропущено: ${e instanceof Error ? e.message : e}`);
      }
    }
    await loadTopics(materialId);
    return { created, failed, jobs: jobs.length };
  }

  // Игры создаются только по команде администратора — кнопкой «Создать игры».
  // По одному запросу к ИИ на тему; темы, где игры уже есть, пропускаются.
  async function generateGames(materialId: string) {
    const topics = await loadTopics(materialId);
    if (gamesPerTopic === 0) return { created: 0, failed: 0, todo: 0 };
    const todo = topics.filter((t) => !t._count.gameItems);
    let created = 0;
    let failed = 0;
    for (let i = 0; i < todo.length; i++) {
      if (stopRef.current) throw new Error(`Остановлено. Создано элементов игр: ${created}`);
      const t = todo[i];
      step({ materialId, stage: `Создаём игры: ${i + 1} из ${todo.length} — «${t.name}»`, done: i, total: todo.length });
      try {
        for (const count of batches(gamesPerTopic)) {
          const r = await withRetry(() => post("/api/learning/games/generate", { topicId: t.id, count, language }));
          created += r.created;
        }
      } catch (e) {
        failed++;
        step({ materialId }, `⚠️ «${t.name}» пропущено: ${e instanceof Error ? e.message : e}`);
      }
    }
    await loadTopics(materialId);
    return { created, failed, todo: todo.length };
  }

  const createTests = (m: Pick<Material, "id" | "chunks" | "status">, analyze: boolean) =>
    run(`auto:${m.id}`, async () => {
      const a = analyze ? await analyzeAll(m) : null;
      const g = await generateAll(m.id);
      setExpanded(m.id);
      setNotice(
        [
          a && `Темы: ${a.topics}.`,
          `Создано вопросов: ${g.created}.`,
          a?.skipped ? `Пропущено частей документа: ${a.skipped}.` : "",
          g.failed ? `Не удалось создать: ${g.failed} из ${g.jobs} — нажмите «Создать тесты» ещё раз, создадутся только недостающие.` : "",
          "Проверьте вопросы в разделе «Вопросы».",
        ]
          .filter(Boolean)
          .join(" ")
      );
    });

  // Документ удаляется вместе с темами, вопросами и играми по нему.
  const removeMaterial = (m: Material) => {
    const q = m._count.questions;
    if (!confirm(`Удалить документ «${m.title}»${q ? ` и все вопросы по нему (${q})` : ""}? Игры по его темам тоже удалятся. Это нельзя отменить.`)) return;
    return run(`delete:${m.id}`, async () => {
      const res = await fetch(`/api/materials/${m.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не удалось удалить");
      if (expanded === m.id) setExpanded(null);
      await loadMaterials();
      setNotice(`Документ «${m.title}» удалён. Вопросов удалено: ${data.questions}${data.games ? `, элементов игр: ${data.games}` : ""}.`);
    });
  };

  const handleUpload = () =>
    run("upload", async () => {
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title || file.name);
      if (replaceId) formData.append("replaceMaterialId", replaceId);
      const res = await fetch("/api/materials/upload", { method: "POST", body: formData });
      if (res.status === 413) throw new Error("Файл слишком большой для загрузки (лимит Vercel — около 4 МБ). Сохраните его как TXT или разбейте на части.");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
      setFile(null);
      setFileKey((k) => k + 1);
      setTitle("");
      setReplaceId("");
      const list = await loadMaterials();
      const m = list.find((x) => x.id === data.material.id);
      if (m && aiOn && autoCreate) {
        setBusy(null);
        await createTestsInline(m);
      } else {
        setNotice(aiOn ? "Документ загружен. Нажмите «🤖 Создать тесты»." : "Документ загружен. Создание тестов станет доступно после подключения ИИ.");
      }
    });

  // Тот же конвейер, но внутри уже идущего run() (после загрузки).
  async function createTestsInline(m: Material) {
    setBusy(`auto:${m.id}`);
    const a = await analyzeAll(m);
    const g = await generateAll(m.id);
    setExpanded(m.id);
    setNotice(
      `Документ загружен и разобран. Темы: ${a.topics}. Создано вопросов: ${g.created}.` +
        (g.failed ? ` Не удалось создать: ${g.failed} — нажмите «Создать тесты» ещё раз.` : "") +
        " Проверьте вопросы в разделе «Вопросы»."
    );
  }

  const createGames = (m: Material) => {
    if (gamesPerTopic === 0) return setNotice("В «Настройках создания» стоит 0 элементов игр на тему — укажите число больше 0.");
    if (!confirm(`Создать игры («Можно или нельзя?» и «Найди и исправь ошибку») по темам документа «${m.title}»? По ${gamesPerTopic} элементов каждой игры на тему.`)) return;
    return run(`games:${m.id}`, async () => {
      const g = await generateGames(m.id);
      setExpanded(m.id);
      setNotice(
        g.todo === 0
          ? "Игры уже созданы по всем темам этого документа. Изменить или удалить их можно в «Обучении»."
          : `Создано элементов игр: ${g.created}.` +
              (g.failed ? ` Не удалось по ${g.failed} темам — нажмите «Создать игры» ещё раз.` : "") +
              " Посмотреть и поправить — в «Админ» → «Обучение»."
      );
    });
  };

  const handleAnalyze = (m: Material) => {
    if (
      m._count.topics > 0 &&
      !confirm(
        "Темы и правила документа будут построены заново. Уже созданные вопросы останутся в тестах, но отвяжутся от тем — после этого «Создать тесты» создаст по новым темам новые вопросы. Продолжить?"
      )
    )
      return;
    return run(`analyze:${m.id}`, async () => {
      const a = await analyzeAll(m);
      await loadTopics(m.id);
      setExpanded(m.id);
      setNotice(`Готово: тем ${a.topics}.` + (a.skipped ? ` Пропущено частей: ${a.skipped}.` : ""));
    });
  };

  const toggleExpand = async (materialId: string) => {
    if (expanded === materialId) return setExpanded(null);
    if (!topicsByMaterial[materialId]) await loadTopics(materialId);
    setExpanded(materialId);
  };

  const generateOne = (materialId: string, topicId: string, level: string, key: string) =>
    run(key, async () => {
      let created = 0;
      for (const part of mixBatches(toNum(mix[level].choice), toNum(mix[level].open))) {
        const r = await post("/api/questions/generate", { topicId, level, ...part, language });
        created += r.questions.length;
      }
      setNotice(`Создано вопросов: ${created}. Проверить и поправить их можно в разделе «Вопросы».`);
      await loadTopics(materialId);
    });

  return (
    <div className="stack">
      <div>
        <h1>База знаний — материалы</h1>
        <p className="muted small">
          Загрузите PDF/DOCX/TXT — Редполитику, Tone of Voice, книги. ИИ прочитает документ целиком (большой — по частям), выделит темы и правила и
          создаст по ним вопросы трёх уровней. Тесты собираются из вопросов всех документов.
        </p>
      </div>

      {status && <AiOffNotice ai={status.ai} />}

      {isSuper && (
        <div className="card stack">
          <h2>Загрузить документ</h2>
          <input className="input" placeholder="Название (необязательно)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input key={fileKey} type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
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
          {aiOn && (
            <>
              <label className="row small" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={autoCreate} onChange={(e) => setAutoCreate(e.target.checked)} />
                Сразу создать тесты после загрузки (по «Вопросов на тему» для Новичка, Middle и Professional)
              </label>

            </>
          )}
          <div>
            <button className="btn btn-primary" onClick={handleUpload} disabled={!file || !!busy}>
              {busy === "upload" ? "Загрузка..." : aiOn && autoCreate ? "Загрузить и создать тесты" : "Загрузить"}
            </button>
            {/* Кнопка недоступна, пока на странице идёт другая операция, — объясняем почему. */}
            {busy && busy !== "upload" && (
              <div className="muted small" style={{ marginTop: 6 }}>
                ⏳ Сейчас идёт другая операция (создание тестов, игр, анализ или удаление) — дождитесь её окончания внизу страницы или нажмите
                «Остановить». Если ничего не идёт, обновите страницу (F5) и выберите файл заново.
              </div>
            )}
            {!file && <div className="muted small" style={{ marginTop: 6 }}>Сначала выберите файл.</div>}
          </div>
          <div className="muted small">Файл до ~4 МБ. PDF должен содержать текст (не сканы страниц).</div>
        </div>
      )}

      {isSuper && aiOn && (
        <div className="card stack">
          <h2>⚙️ Настройки создания</h2>
          <div className="muted small" style={{ marginTop: -8 }}>Действуют для «🤖 Создать тесты», «🎮 Создать игры» и кнопок «+» у тем.</div>
          <label className="row small">
            Язык вопросов и игр:
            <select className="select" style={{ width: "auto", padding: "6px 10px" }} value={language} onChange={(e) => setLanguage(e.target.value as typeof language)}>
              <option value="auto">Как в документе</option>
              <option value="ru">🇷🇺 Русский</option>
              <option value="uz">🇺🇿 Oʻzbekcha (lotin)</option>
            </select>
          </label>
          <div className="small">
            <div style={{ fontWeight: 800 }}>Вопросов на тему для каждого уровня</div>
            <div className="muted">
              С вариантами — сотрудник выбирает ответ; открытые — пишет сам. Новичку открытые даются простые: назвать ошибку или ответить одной фразой. 0 и 0 — уровень не
              создаётся. Для большого документа с десятками тем хватит 2–4 на уровень.
            </div>
            <div className="table-wrap" style={{ marginTop: 6 }}>
              <table className="table" style={{ width: "auto" }}>
                <thead>
                  <tr>
                    <th>Уровень</th>
                    <th>С вариантами</th>
                    <th>Открытых</th>
                    <th>Всего</th>
                  </tr>
                </thead>
                <tbody>
                  {LEVELS.map((l) => (
                    <tr key={l.id}>
                      <td>{l.label}</td>
                      {(["choice", "open"] as const).map((kind) => (
                        <td key={kind}>
                          <input
                            className="input"
                            style={{ width: 70, padding: "6px 8px" }}
                            type="number"
                            min={0}
                            max={30}
                            aria-label={`${l.label}: ${kind === "choice" ? "с вариантами" : "открытых"}`}
                            value={mix[l.id][kind]}
                            onChange={(e) => setMix((m) => ({ ...m, [l.id]: { ...m[l.id], [kind]: e.target.value } }))}
                            onBlur={(e) => {
                              const v = String(toNum(e.target.value));
                              setMix((m) => ({ ...m, [l.id]: { ...m[l.id], [kind]: v } }));
                              saveMix(l.id, kind, v);
                            }}
                          />
                        </td>
                      ))}
                      <td style={{ fontWeight: 800 }}>{levelTotal(l.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <label className="row small">
            Для «🎮 Создать игры» — элементов на тему:
            <input
              className="input"
              style={{ width: 80, padding: "6px 8px" }}
              type="number"
              min={0}
              value={gamesPerTopicText}
              onChange={(e) => setGamesPerTopicText(e.target.value)}
              onBlur={() => setGamesPerTopicText(String(gamesPerTopic))}
            />
          </label>
        </div>
      )}

      {progress && (
        <div className="card stack">
          <div className="row between">
            <strong>🤖 {progress.stage}</strong>
            <button className="btn btn-ghost btn-sm" onClick={() => (stopRef.current = true)}>
              Остановить
            </button>
          </div>
          <div className="seg" style={{ height: 10 }}>
            <div
              style={{
                width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%`,
                height: "100%",
                borderRadius: 99,
                background: "var(--gradient)",
                transition: "width .3s",
              }}
            />
          </div>
          {progress.log.map((l, i) => (
            <div key={i} className="muted small">
              {l}
            </div>
          ))}
          <div className="muted small">Не закрывайте страницу, пока идёт обработка.</div>
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
                {m.type.toUpperCase()} · ~{pages(m.chars)} стр. · {STATUS_LABEL[m.status]} · тем: {m._count.topics} · вопросов: {m._count.questions}
              </div>
            </div>
            <div className="row">
              {isSuper && m.isActive && aiOn && (
                <>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!!busy}
                    onClick={() => createTests(m, m.status !== "PROCESSED")}
                    title={m.status === "PROCESSED" ? "Создать недостающие вопросы по готовым темам" : "Прочитать документ и создать вопросы"}
                  >
                    {busy === `auto:${m.id}` ? "Работаем..." : "🤖 Создать тесты"}
                  </button>
                  {m._count.topics > 0 && (
                    <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => createGames(m)} title="Создать обучающие игры по темам документа">
                      {busy === `games:${m.id}` ? "Работаем..." : "🎮 Создать игры"}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => handleAnalyze(m)} disabled={!!busy}>
                    {busy === `analyze:${m.id}` ? "Анализ..." : m.status === "PROCESSED" ? "Переанализировать" : "Только анализ"}
                  </button>
                </>
              )}
              {m._count.topics > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => toggleExpand(m.id)}>
                  {expanded === m.id ? "📚 Скрыть темы" : "📚 Показать темы"}
                </button>
              )}
              {isSuper && (
                <button className="btn btn-danger btn-sm" disabled={!!busy} onClick={() => removeMaterial(m)}>
                  {busy === `delete:${m.id}` ? "Удаляем..." : "🗑 Удалить"}
                </button>
              )}
            </div>
          </div>

          {expanded === m.id && topicsByMaterial[m.id] && (
            <div className="stack mt" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              {topicsByMaterial[m.id].length === 0 && <div className="muted small">ИИ не нашёл тем в документе</div>}
              {topicsByMaterial[m.id].map((topic) => (
                <div key={topic.id} style={{ paddingLeft: 12, borderLeft: "4px solid var(--accent)" }}>
                  <div style={{ fontWeight: 900 }}>
                    {topic.name}{" "}
                    {LEVELS.map((l) => (
                      <span key={l.id} className="badge" style={{ marginLeft: 4 }}>
                        {l.label}: {topic.questions.filter((q) => q.level === l.id).length}
                      </span>
                    ))}
                  </div>
                  {topic.description && <div className="muted small">{topic.description}</div>}
                  <details style={{ marginTop: 6 }}>
                    <summary className="small muted" style={{ cursor: "pointer" }}>
                      Правила: {topic.rules.length}
                    </summary>
                    <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                      {topic.rules.map((r) => (
                        <div key={r.id} className="small">
                          <strong>{RULE_LABEL[r.type] ?? r.type}:</strong> {r.text}
                          {r.sourceQuote && <div className="muted" style={{ fontStyle: "italic" }}>«{r.sourceQuote}»</div>}
                        </div>
                      ))}
                    </div>
                  </details>
                  {isSuper && aiOn && m.isActive && (
                    <div className="row" style={{ marginTop: 8 }}>
                      {LEVELS.map((l) => (
                        <button
                          key={l.id}
                          className="btn btn-ghost btn-sm"
                          disabled={!!busy || levelTotal(l.id) === 0}
                          onClick={() => generateOne(m.id, topic.id, l.id, `topic:${topic.id}:${l.id}`)}
                        >
                          {busy === `topic:${topic.id}:${l.id}` ? "Генерируем..." : `+ ${levelTotal(l.id)} ${l.label}`}
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
