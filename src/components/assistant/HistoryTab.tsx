"use client";

import { useEffect, useState } from "react";
import { markCoachDone } from "./CoachTab";
import { CheckView, CoachView, FavButton, ReplyView, toneLabel, type ApiExtra, type HistoryItem } from "./shared";

const MODE_LABEL = { reply: "✨ Ответ клиенту", check: "🔍 Проверка ответа", coach: "🎯 Тренер" };

// История ответов помощника: поиск, только избранное, раскрыть запись, удалить.
export function HistoryTab({ onExtra }: { onExtra: (d: ApiExtra) => void }) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [q, setQ] = useState("");
  const [fav, setFav] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/assistant/history?q=${encodeURIComponent(q)}${fav ? "&fav=1" : ""}`)
        .then((r) => r.json())
        .then((d) => setItems(d.items ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [q, fav]);

  async function remove(id: string) {
    if (!confirm("Удалить запись из истории? Ответ в лимит не вернётся.")) return;
    await fetch(`/api/assistant/history/${id}`, { method: "DELETE" });
    setItems((list) => list?.filter((i) => i.id !== id) ?? null);
  }

  return (
    <div className="stack">
      <div className="card row" style={{ gap: 10 }}>
        <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="🔎 Поиск по истории" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={`btn btn-sm ${fav ? "btn-primary" : "btn-ghost"}`} onClick={() => setFav(!fav)}>
          ⭐ Только избранное
        </button>
      </div>
      {!items ? (
        <div className="spinner" />
      ) : items.length === 0 ? (
        <div className="card muted center">{q || fav ? "Ничего не найдено" : "История пока пустая — здесь будут все ваши ответы"}</div>
      ) : (
        items.map((i) => (
          <div key={i.id} className="card stack" style={{ gap: 8 }}>
            <div className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              <button
                style={{ all: "unset", cursor: "pointer", flex: 1, minWidth: 0 }}
                onClick={() => setOpen(open === i.id ? null : i.id)}
                aria-expanded={open === i.id}
              >
                <div className="muted small">
                  {MODE_LABEL[i.mode]} · {new Date(i.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {i.tone && i.tone !== "default" ? ` · ${toneLabel(i.tone)}` : ""}
                </div>
                <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: open === i.id ? "pre-wrap" : "nowrap" }}>
                  {i.mode === "check" ? i.draft : i.input || "—"}
                </div>
              </button>
              <div className="row" style={{ gap: 6, flex: "none" }}>
                <FavButton id={i.id} value={i.favorite} onChange={(v) => setItems((list) => list?.map((x) => (x.id === i.id ? { ...x, favorite: v } : x)) ?? null)} />
                <button className="btn btn-ghost btn-sm" title="Удалить" onClick={() => remove(i.id)}>
                  🗑
                </button>
              </div>
            </div>
            {open === i.id && (
              <>
                {i.mode === "check" && i.input && <div className="muted small">Клиент: {i.input}</div>}
                {i.mode === "reply" && <ReplyView reply={i.result} />}
                {i.mode === "check" && <CheckView check={i.result} />}
                {i.mode === "coach" && <CoachView plan={i.result} onDone={() => markCoachDone(i.id).then((achievements) => onExtra({ achievements }))} />}
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
