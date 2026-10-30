"use client";

import { useState } from "react";
import { compress } from "@/components/admin/ImagePicker";
import { callApi, FavButton, ReplyView, TONES, type ApiExtra, type ReplyResult } from "./shared";

// «Ответ клиенту»: текст сообщения и/или скриншот переписки (можно вставить Ctrl+V), выбор тона.
export function ReplyTab({ disabled, onExtra }: { disabled: boolean; onExtra: (d: ApiExtra) => void }) {
  const [message, setMessage] = useState("");
  const [image, setImage] = useState("");
  const [tone, setTone] = useState("default");
  const [reply, setReply] = useState<(ReplyResult & ApiExtra) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addImage(file: File | undefined | null) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      setImage(await compress(file));
    } catch {
      setError("Не удалось открыть картинку");
    }
  }

  async function ask() {
    setLoading(true);
    setError(null);
    setReply(null);
    const { ok, data } = await callApi<ReplyResult>("/api/assistant", { mode: "reply", message, tone, image: image || undefined });
    setLoading(false);
    onExtra(data);
    if (!ok) return setError(data.error ?? "Ошибка");
    setReply(data);
  }

  const canAsk = !loading && !disabled && (!!message.trim() || !!image);
  return (
    <div className="stack">
      <div className="card stack">
        <textarea
          className="textarea"
          rows={5}
          maxLength={3000}
          placeholder="Сообщение клиента, например: «Здравствуйте, деньги списались два раза, что делать?» — или вставьте скриншот переписки (Ctrl+V)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onPaste={(e) => {
            const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
            if (file) {
              e.preventDefault();
              addImage(file);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canAsk) ask();
          }}
        />
        {image ? (
          <div className="row" style={{ gap: 10, alignItems: "flex-start", flexWrap: "nowrap" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Скриншот переписки" style={{ maxHeight: 160, maxWidth: "60%", borderRadius: 12, border: "1px solid var(--border)" }} />
            <div className="stack" style={{ gap: 6 }}>
              <span className="muted small">ИИ прочитает переписку на скриншоте и ответит на последние сообщения клиента. В поле выше можно добавить пояснение.</span>
              <button className="btn btn-danger btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setImage("")}>
                Убрать скриншот
              </button>
            </div>
          </div>
        ) : (
          <label className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", cursor: "pointer" }}>
            📷 Скриншот переписки
            <input type="file" accept="image/*" hidden onChange={(e) => addImage(e.target.files?.[0])} />
          </label>
        )}
        <div className="row" style={{ gap: 6 }}>
          <span className="muted small">Тон:</span>
          {TONES.map((t) => (
            <button key={t.id} className={`btn btn-sm ${tone === t.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setTone(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="row between">
          <span className="muted small">Ctrl + Enter — получить ответ</span>
          <button className="btn btn-primary" disabled={!canAsk} onClick={ask}>
            {loading ? "ИИ составляет ответ…" : "✨ Получить ответ"}
          </button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
      </div>

      {reply && (
        <>
          {reply.historyId && (
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <FavButton id={reply.historyId} value={false} />
            </div>
          )}
          <ReplyView reply={reply} />
        </>
      )}
    </div>
  );
}
