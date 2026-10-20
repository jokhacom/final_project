"use client";

import { useEffect, useRef, useState } from "react";

// Свой просмотрщик PDF (pdf.js): браузеры на Android не показывают PDF внутри страницы.
// Страницы рисуются по очереди с учётом плотности экрана, чтобы текст был чётким.
export function PdfViewer({ src }: { src: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = box.current;
    if (!container) return;
    container.innerHTML = "";
    setError(null);
    setStatus(null);

    (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      const doc = await pdfjs.getDocument({ url: src, withCredentials: true }).promise;
      setStatus({ loaded: 0, total: doc.numPages });
      const width = container.clientWidth || 800;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width / base.width) * ratio });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = "100%";
        canvas.style.display = "block";
        canvas.style.marginBottom = "8px";
        canvas.style.borderRadius = "8px";
        container.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        if (!cancelled) setStatus({ loaded: n, total: doc.numPages });
      }
    })().catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div style={{ flex: 1, overflow: "auto", borderRadius: 12, background: "#525659", padding: 8 }}>
      {error && (
        <div className="alert alert-error">
          Не удалось открыть PDF: {error}.{" "}
          <a href={src} target="_blank" rel="noreferrer">
            Открыть файл
          </a>
        </div>
      )}
      {!error && status && status.loaded < status.total && (
        <div className="small" style={{ color: "#fff", marginBottom: 8 }}>
          Загружаем страницы: {status.loaded} из {status.total}
        </div>
      )}
      {!error && !status && <div className="spinner" />}
      <div ref={box} />
    </div>
  );
}
