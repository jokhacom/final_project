"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

// Свой просмотрщик PDF (pdf.js): браузеры на Android не показывают PDF внутри страницы.
// Как слайды: одна страница на экране, листать свайпом, стрелками ‹ › или клавишами ← →.
// Страница вписывается в окно (и перерисовывается при смене его размера) с учётом плотности экрана, чтобы текст был чётким.
const MAX_CANVAS_PIXELS = 16_000_000;

export function PdfViewer({ src }: { src: string }) {
  const area = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setPage(1);
    setError(null);
    (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      const d = await pdfjs.getDocument({ url: src, withCredentials: true }).promise;
      if (!cancelled) setDoc(d);
    })().catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [src]);

  // Рисуем текущую страницу; при смене размера окна — заново.
  useEffect(() => {
    if (!doc || !area.current || !canvas.current) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let stopped = false;
    const draw = async () => {
      task?.cancel();
      const p = await doc.getPage(page);
      if (stopped || !area.current || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const fit = Math.min(area.current.clientWidth / base.width, area.current.clientHeight / base.height);
      // Рисуем минимум в 2 раза плотнее экрана (до 3×): на обычных мониторах текст иначе выходит мыльным.
      // Но не больше MAX_CANVAS_PIXELS — на iPhone слишком большой canvas остаётся пустым.
      let ratio = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
      const area0 = base.width * fit * base.height * fit;
      if (area0 * ratio * ratio > MAX_CANVAS_PIXELS) ratio = Math.sqrt(MAX_CANVAS_PIXELS / area0);
      const viewport = p.getViewport({ scale: fit * ratio });
      // Целые размеры: дробная ширина canvas растягивает картинку на долю пикселя и размывает её.
      const w = Math.floor(viewport.width);
      const h = Math.floor(viewport.height);
      const c = canvas.current;
      c.width = w;
      c.height = h;
      c.style.width = `${w / ratio}px`;
      c.style.height = `${h / ratio}px`;
      task = p.render({ canvasContext: c.getContext("2d")!, viewport });
      await task.promise.catch(() => {});
    };
    draw();
    // Перерисовываем при любом изменении размера: поворот телефона, «На весь экран».
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(draw, 150);
    });
    observer.observe(area.current);
    return () => {
      stopped = true;
      task?.cancel();
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [doc, page]);

  const total = doc?.numPages ?? 0;
  const go = (delta: number) => setPage((n) => Math.min(Math.max(n + delta, 1), total || 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (error) {
    return (
      <div className="alert alert-error">
        Не удалось открыть PDF: {error}.{" "}
        <a href={src} target="_blank" rel="noreferrer">
          Открыть файл
        </a>
      </div>
    );
  }

  return (
    <div className="pdf-slides">
      <div
        ref={area}
        className="pdf-slide-area"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); // свайп влево — следующий слайд
        }}
      >
        {!doc && <div className="spinner" />}
        <canvas ref={canvas} style={{ display: doc ? "block" : "none" }} />
        <button className="pdf-arrow left" onClick={() => go(-1)} disabled={page <= 1} aria-label="Предыдущий слайд">
          ‹
        </button>
        <button className="pdf-arrow right" onClick={() => go(1)} disabled={!total || page >= total} aria-label="Следующий слайд">
          ›
        </button>
      </div>
      {total > 0 && (
        <div className="pdf-counter">
          {page} / {total}
        </div>
      )}
    </div>
  );
}
