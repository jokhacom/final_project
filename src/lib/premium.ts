// Срок премиума («Помощник ответов»). Без обращения к базе — используется и на сервере, и в браузере.
// Даты — "YYYY-MM-DD" по Ташкенту, обе включительно; пустая — без ограничения.
export type PremiumState = "off" | "active" | "soon" | "expired";
export type PremiumFields = { premium: boolean; premiumFrom: string | null; premiumUntil: string | null };

export const tashkentToday = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(d);

export function premiumState(u: PremiumFields, today = tashkentToday()): PremiumState {
  if (!u.premium) return "off";
  if (u.premiumFrom && today < u.premiumFrom) return "soon";
  if (u.premiumUntil && today > u.premiumUntil) return "expired";
  return "active";
}

// "2026-11-30" → "30.11.2026"
export const formatDay = (day: string) => day.split("-").reverse().join(".");

// То же число через несколько месяцев (кнопки «+1 месяц» и т. п.): 29.10 → 29.11; 31.01 + 1 месяц → 28.02.
export function addMonths(day: string, months: number) {
  const [y, m, d] = day.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
}
