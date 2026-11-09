"use client";

import { useEffect, useRef, useState } from "react";

type Rect = { x: number; y: number; w: number; h: number }; // в пикселях исходной картинки

// Закрашивание личных данных клиента на скриншоте перед отправкой ИИ: сотрудник обводит мышью или пальцем
// ФИО, телефоны, номера карт — эти места становятся чёрными прямо в картинке (не наложением), и только
// после галочки «Я закрыл(а) личные данные» картинка уходит на сервер.
export function ScreenshotRedactor({ src, onDone, onCancel }: { src: string; onDone: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rects, setRects] = useState<Rect[]>([]);
  const [draft, setDraft] = useState<Rect | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw([], null);
    };
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function draw(list: Rect[], d: Rect | null) {
    const c = canvasRef.current, img = imgRef.current;
    if (!c || !img) return;
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = "#000";
    for (const r of list) ctx.fillRect(r.x, r.y, r.w, r.h);
    if (d) {
      ctx.fillStyle = "rgba(0,0,0,.6)";
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
  }

  useEffect(() => draw(rects, draft), [rects, draft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Координаты указателя → пиксели картинки (канвас показан уменьшенным).
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const b = c.getBoundingClientRect();
    return { x: ((e.clientX - b.left) / b.width) * c.width, y: ((e.clientY - b.top) / b.height) * c.height };
  };
  const norm = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="alert alert-error" style={{ margin: 0 }}>
        🔒 Закрасьте личные данные клиента: <strong>ФИО, телефон, дату рождения, паспорт / ID-карту, номер карты</strong>. Проведите мышкой или пальцем по
        этим местам — они станут чёрными.
      </div>
      <canvas
        ref={canvasRef}
        aria-label="Скриншот: проведите по личным данным, чтобы закрасить"
        style={{ maxWidth: "100%", maxHeight: 520, borderRadius: 12, border: "1px solid var(--border)", cursor: "crosshair", touchAction: "none", alignSelf: "flex-start" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = point(e);
          setConfirmed(false);
        }}
        onPointerMove={(e) => start.current && setDraft(norm(start.current, point(e)))}
        onPointerUp={(e) => {
          if (!start.current) return;
          const r = norm(start.current, point(e));
          start.current = null;
          setDraft(null);
          if (r.w > 4 && r.h > 4) setRects((list) => [...list, r]);
        }}
      />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost btn-sm" disabled={!rects.length} onClick={() => setRects((l) => l.slice(0, -1))}>
          ↩ Отменить
        </button>
        <button className="btn btn-ghost btn-sm" disabled={!rects.length} onClick={() => setRects([])}>
          Очистить
        </button>
        <span className="muted small">Закрашено мест: {rects.length}</span>
      </div>
      <label className="row small" style={{ gap: 8, fontWeight: 800, cursor: "pointer" }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        Я закрасил(а) все личные данные клиента на скриншоте
      </label>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={!confirmed} onClick={() => onDone(canvasRef.current!.toDataURL("image/jpeg", 0.85))}>
          ✅ Готово
        </button>
        <button className="btn btn-danger btn-sm" onClick={onCancel}>
          Убрать скриншот
        </button>
      </div>
    </div>
  );
}
