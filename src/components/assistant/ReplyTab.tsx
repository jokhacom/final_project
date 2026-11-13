"use client";

import { useEffect, useState } from "react";
import { compress } from "@/components/admin/ImagePicker";
import { ScreenshotRedactor } from "./ScreenshotRedactor";
import { callApi, FavButton, MaskedNote, ReplyView, TONES, type ApiExtra, type ReplyResult } from "./shared";

const CHANNELS: { id: "review" | "dm"; label: string }[] = [
  { id: "review", label: "⭐ Отзыв" },
  { id: "dm", label: "💬 Личное сообщение" },
];

// «Ответ клиенту»: текст сообщения и/или скриншот переписки (можно вставить Ctrl+V), выбор тона.
export function ReplyTab({ disabled, onExtra }: { disabled: boolean; onExtra: (d: ApiExtra) => void }) {
  const [message, setMessage] = useState("");
  const [image, setImage] = useState(""); // скриншот с закрашенными личными данными — только он уходит на сервер
  const [rawImage, setRawImage] = useState(""); // исходный скриншот, пока сотрудник закрашивает (остаётся в браузере)
  const [shotsOn, setShotsOn] = useState(true);
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setShotsOn(!(d.settings ?? []).some((s: { key: string; value: string }) => s.key === "assistant_screenshots" && s.value === "false")))
      .catch(() => {});
  }, []);
  // Тонов можно выбрать несколько; ни одного — «Как в шаблонах».
  const [tones, setTones] = useState<string[]>([]);
  const toggleTone = (id: string) =>
    id === "default" ? setTones([]) : setTones((list) => (list.includes(id) ? list.filter((t) => t !== id) : [...list, id]));
  const toneActive = (id: string) => (id === "default" ? tones.length === 0 : tones.includes(id));
  // Куда отвечаем: отзыв (ответ публичный) или личное сообщение. Для отзыва можно указать оценку.
  const [channel, setChannel] = useState<"review" | "dm">("review");
  const [rating, setRating] = useState(0);
  const [reply, setReply] = useState<(ReplyResult & ApiExtra) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addImage(file: File | undefined | null) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      setImage("");
      setRawImage(await compress(file));
    } catch {
      setError("Не удалось открыть картинку");
    }
  }

  async function ask() {
    setLoading(true);
    setError(null);
    setReply(null);
    const { ok, data } = await callApi<ReplyResult>("/api/assistant", { mode: "reply", channel, rating: channel === "review" && rating ? rating : undefined, message, tones, image: image || undefined, imageRedacted: !!image });
    setLoading(false);
    onExtra(data);
    if (!ok) return setError(data.error ?? "Ошибка");
    setReply(data);
  }

  const canAsk = !loading && !disabled && !rawImage && (!!message.trim() || !!image);
  return (
    <div className="stack">
      <div className="card stack">
        <div className="row" style={{ gap: 6 }}>
          <span className="muted small">Куда отвечаем:</span>
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              className={`btn btn-sm ${channel === c.id ? "btn-primary" : "btn-ghost"}`}
              aria-pressed={channel === c.id}
              onClick={() => setChannel(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        {channel === "review" && (
          <div className="row" style={{ gap: 4 }}>
            <span className="muted small">Оценка (если видна):</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className="btn btn-ghost btn-sm"
                style={{ padding: "2px 6px", fontSize: 20, color: n <= rating ? "#f5b301" : "var(--muted)" }}
                aria-label={`${n} из 5`}
                aria-pressed={n === rating}
                onClick={() => setRating(n === rating ? 0 : n)}
              >
                {n <= rating ? "★" : "☆"}
              </button>
            ))}
          </div>
        )}
        <textarea
          className="textarea"
          rows={5}
          maxLength={3000}
          placeholder={
            (channel === "review"
              ? "Текст отзыва, например: «Приложение постоянно вылетает, невозможно пользоваться!»"
              : "Сообщение клиента, например: «Здравствуйте, деньги списались два раза, что делать?»") +
            (shotsOn ? (channel === "review" ? " — или вставьте скриншот отзыва (Ctrl+V)" : " — или вставьте скриншот переписки (Ctrl+V)") : "")
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onPaste={(e) => {
            const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
            if (file && shotsOn) {
              e.preventDefault();
              addImage(file);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canAsk) ask();
          }}
        />
        {rawImage ? (
          <ScreenshotRedactor
            src={rawImage}
            onDone={(url) => {
              setImage(url);
              setRawImage("");
            }}
            onCancel={() => setRawImage("")}
          />
        ) : image ? (
          <div className="row" style={{ gap: 10, alignItems: "flex-start", flexWrap: "nowrap" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Скриншот переписки" style={{ maxHeight: 160, maxWidth: "60%", borderRadius: 12, border: "1px solid var(--border)" }} />
            <div className="stack" style={{ gap: 6 }}>
              <span className="muted small">
                {channel === "review" ? "ИИ прочитает отзыв на скриншоте и ответит на него." : "ИИ прочитает переписку на скриншоте и ответит на последние сообщения клиента."} В поле выше можно добавить пояснение.
              </span>
              <button className="btn btn-danger btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setImage("")}>
                Убрать скриншот
              </button>
            </div>
          </div>
        ) : shotsOn ? (
          <label className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", cursor: "pointer" }}>
            {channel === "review" ? "📷 Скриншот отзыва" : "📷 Скриншот переписки"}
            <input type="file" accept="image/*" hidden onChange={(e) => addImage(e.target.files?.[0])} />
          </label>
        ) : null}
        <div className="muted small">🔒 ФИО, телефоны, даты рождения, паспорт / ID-карта, номера карт и счетов скрываются автоматически — ИИ их не видит.</div>
        <div className="row" style={{ gap: 6 }}>
          <span className="muted small">Тон (можно несколько):</span>
          {TONES.map((t) => (
            <button
              key={t.id}
              className={`btn btn-sm ${toneActive(t.id) ? "btn-primary" : "btn-ghost"}`}
              aria-pressed={toneActive(t.id)}
              onClick={() => toggleTone(t.id)}
            >
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
          <MaskedNote d={reply} />
          <ReplyView reply={reply} />
        </>
      )}
    </div>
  );
}
