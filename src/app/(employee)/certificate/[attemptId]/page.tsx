"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { levelInfo } from "@/lib/levels";
import type { AttemptResult } from "@/lib/types";

// Сертификат за результат выше 90 🍬. Сохраняется в PDF через печать браузера.
export default function CertificatePage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [data, setData] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/attempts/${attemptId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Не удалось загрузить");
        if (!d.certificateEligible) throw new Error("Сертификат выдаётся только при результате выше 90 🍬");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [attemptId]);

  if (error) {
    return (
      <main className="container narrow">
        <div className="alert alert-error">{error}</div>
      </main>
    );
  }
  if (!data) return null;

  const info = levelInfo(data.level);
  const date = new Date(data.finishedAt ?? data.startedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="container" style={{ maxWidth: 900 }}>
      <div className="row no-print" style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨 Скачать PDF / распечатать
        </button>
        <Link href={`/result/${attemptId}`} className="btn btn-ghost">
          ← К результату
        </Link>
      </div>

      <div
        style={{
          background: "#fff",
          color: "#2a1745",
          borderRadius: 24,
          padding: "56px 48px",
          textAlign: "center",
          border: "10px solid transparent",
          backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #7C4DFF, #FF6FA5)",
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
        }}
      >
        <div style={{ fontSize: 56 }}>🍬</div>
        <div style={{ letterSpacing: 6, fontWeight: 900, color: "#7C4DFF" }}>СЕРТИФИКАТ</div>
        <div style={{ marginTop: 8, color: "#7a6a93" }}>Тренажер знаний ГЦО</div>
        <div style={{ marginTop: 36, color: "#7a6a93" }}>Настоящим подтверждается, что</div>
        <div style={{ fontSize: 36, fontWeight: 900, margin: "8px 0" }}>{data.userName}</div>
        <div style={{ color: "#7a6a93" }}>успешно прошёл(а) тестирование по стандартам обслуживания</div>
        <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#7a6a93", fontSize: 13 }}>Уровень</div>
            <div style={{ fontWeight: 900, fontSize: 20, color: info.color === "#FFC93C" ? "#c99700" : info.color }}>{info.label}</div>
          </div>
          <div>
            <div style={{ color: "#7a6a93", fontSize: 13 }}>Результат</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{data.candies} из 100 🍬</div>
          </div>
          <div>
            <div style={{ color: "#7a6a93", fontSize: 13 }}>Оценка</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{data.resultLabel}</div>
          </div>
        </div>
        <div style={{ marginTop: 36, color: "#7a6a93", fontSize: 14 }}>{date}</div>
      </div>
    </main>
  );
}
