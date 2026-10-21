"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Простые графики на SVG без библиотек: столбцы по дням, линия, горизонтальные полосы.
// Цвета — из CSS-переменных (--chart-*, --lvl-*), у тёмной темы свои оттенки.

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

type Tip = { x: number; y: number; content: ReactNode } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  );
}

const PAD = { top: 12, right: 8, bottom: 26, left: 34 };

// Подписи оси Y: 0 и 3–4 «круглых» деления до max.
function ticks(max: number) {
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : max <= 100 ? 25 : Math.ceil(max / 4 / 10) * 10;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const out: number[] = [];
  for (let v = 0; v <= top; v += step) out.push(v);
  return { top, out };
}

// Подписи оси X — не больше ~7, чтобы не налезали.
const xLabelEvery = (n: number, width: number) => Math.max(1, Math.ceil(n / Math.max(2, Math.floor(width / 80))));

export type Point = { label: string; value: number | null; tip: string };

export function ColumnChart({ data, height = 180 }: { data: Point[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const { top, out } = ticks(Math.max(1, ...data.map((d) => d.value ?? 0)));
  const iw = width - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const slot = iw / Math.max(1, data.length);
  const bar = Math.max(2, slot - 2); // 2px зазор между столбцами
  const every = xLabelEvery(data.length, width);
  const y = (v: number) => PAD.top + ih - (v / top) * ih;

  return (
    <div ref={ref} className="chart" onMouseLeave={() => setTip(null)}>
      <svg width={width} height={height} role="img">
        {out.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="chart-axis">
              {v}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = d.value ?? 0;
          const x = PAD.left + i * slot + (slot - bar) / 2;
          const h = Math.max(0, (v / top) * ih);
          const r = Math.min(4, bar / 2, h);
          return (
            <g key={i}>
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + bar - r} Q${x + bar},${y(v)} ${x + bar},${y(v) + r} V${y(0)} Z`}
                  className="chart-bar"
                />
              )}
              {/* Зона наведения шире столбца */}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={ih}
                fill="transparent"
                onMouseMove={() => setTip({ x: x + bar / 2, y: y(v), content: d.tip })}
              />
              {i % every === 0 && (
                <text x={x + bar / 2} y={height - 8} textAnchor="middle" className="chart-axis">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

export function LineChart({ data, height = 180, max = 100 }: { data: Point[]; height?: number; max?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const [hover, setHover] = useState<number | null>(null);
  const { top, out } = ticks(max);
  const iw = width - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.top + ih - (v / top) * ih;
  const every = xLabelEvery(data.length, width);
  // Дни без тестов — разрыв линии, а не падение в ноль.
  const path = data
    .map((d, i) => (d.value === null ? null : `${i > 0 && data[i - 1].value !== null ? "L" : "M"}${x(i)},${y(d.value)}`))
    .filter(Boolean)
    .join(" ");

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (data.length - 1));
    const d = data[Math.min(Math.max(i, 0), data.length - 1)];
    if (!d) return;
    const idx = data.indexOf(d);
    setHover(idx);
    setTip({ x: x(idx), y: d.value === null ? PAD.top + ih / 2 : y(d.value), content: d.tip });
  }

  return (
    <div ref={ref} className="chart" onMouseLeave={() => (setTip(null), setHover(null))}>
      <svg width={width} height={height} role="img">
        {out.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="chart-axis">
              {v}
            </text>
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} className="chart-cross" />}
        <path d={path} className="chart-line" />
        {data.map((d, i) =>
          d.value === null ? null : <circle key={i} cx={x(i)} cy={y(d.value)} r={hover === i ? 5 : 4} className="chart-dot" />
        )}
        {data.map((d, i) =>
          i % every === 0 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="chart-axis">
              {d.label}
            </text>
          ) : null
        )}
        <rect x={PAD.left} y={PAD.top} width={iw} height={ih} fill="transparent" onMouseMove={onMove} />
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// Горизонтальные полосы с подписью значения справа (цвет — у сущности, текст — обычный).
export function BarList({ rows, max = 100 }: { rows: { label: string; value: number; display: string; color?: string; tip?: string }[]; max?: number }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {rows.map((r) => (
        <div key={r.label} title={r.tip}>
          <div className="row between small">
            <span style={{ fontWeight: 700 }}>{r.label}</span>
            <span className="muted">{r.display}</span>
          </div>
          <div className="barlist-track">
            <div className="barlist-fill" style={{ width: `${Math.min(100, (r.value / max) * 100)}%`, background: r.color ?? "var(--chart-1)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
