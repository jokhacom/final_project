"use client";

import { useState } from "react";

// Уменьшаем скриншот в браузере (до 1600px по длинной стороне, JPEG), чтобы он
// быстро грузился у сотрудников и помещался в лимит запроса.
const MAX_SIDE = 1600;

export function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff"; // прозрачный фон PNG → белый
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Не удалось открыть картинку"));
    img.src = URL.createObjectURL(file);
  });
}

export function ImagePicker({ value, onChange, label = "Скриншот к вопросу (необязательно)" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Выберите картинку (PNG, JPG)");
    try {
      onChange(await compress(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="field">
      <span>{label}</span>
      {value ? (
        <div className="stack" style={{ gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Скриншот" className="question-image" />
          <div className="row">
            <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
              Заменить
              <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => onChange("")}>
              Убрать
            </button>
          </div>
        </div>
      ) : (
        <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} />
      )}
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
