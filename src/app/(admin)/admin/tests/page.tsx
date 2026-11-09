"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LEVELS, type LevelId } from "@/lib/levels";
import { useAdminStatus } from "@/components/admin/useAdminStatus";

type Mix = { choice: string; open: string };

// Состав теста по уровням: сколько вопросов с вариантами (закрытых) и открытых получает сотрудник.
// Вопросы каждый раз выбираются случайно из банка уровня; при повторной попытке — сначала те, что он ещё не видел.
export default function AdminTestsPage() {
  const { data: session } = useSession();
  const isSuper = (session?.user as any)?.role === "SUPERADMIN";
  const [level, setLevel] = useState<LevelId>("BEGINNER");
  const [mix, setMix] = useState<Record<string, Mix>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const status = useAdminStatus();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const list: { key: string; value: string }[] = d.settings ?? [];
        const get = (k: string) => list.find((s) => s.key === k)?.value;
        setMix(
          Object.fromEntries(
            LEVELS.map((l) => {
              const c = get(`test_choice_${l.id}`), o = get(`test_open_${l.id}`);
              if (c !== undefined && o !== undefined) return [l.id, { choice: c, open: o }];
              // Ещё не настроено — как сейчас работает тест: «вопросов в тесте» поровну.
              const n = Number(get(`test_question_count_${l.id}`) ?? get("test_question_count") ?? 10) || 10;
              return [l.id, { choice: String(Math.ceil(n / 2)), open: String(Math.floor(n / 2)) }];
            })
          )
        );
      });
  }, []);

  const cur = mix[level] ?? { choice: "0", open: "0" };
  const choice = Math.max(0, Math.round(Number(cur.choice)) || 0);
  const open = Math.max(0, Math.round(Number(cur.open)) || 0);
  const total = choice + open;
  const bank = status?.levels.find((l) => l.id === level);
  const info = LEVELS.find((l) => l.id === level)!;

  const set = (field: keyof Mix, v: string) => {
    setMsg(null);
    setMix((m) => ({ ...m, [level]: { ...cur, [field]: v.replace(/\D/g, "") } }));
  };

  async function save() {
    if (total < 1) return setMsg({ ok: false, text: "В тесте должен быть хотя бы 1 вопрос" });
    for (const [key, value] of [[`test_choice_${level}`, String(choice)], [`test_open_${level}`, String(open)]]) {
      const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return setMsg({ ok: false, text: d.error ?? "Не удалось сохранить" });
      }
    }
    setMsg({ ok: true, text: `Сохранено: «${info.label}» — ${total} вопросов (${choice} закрытых, ${open} открытых). Новые попытки — уже с этими настройками.` });
  }

  // Сколько раз подряд сотрудник может пройти тест, не встретив ни одного повтора.
  const runs = bank
    ? Math.min(choice ? Math.floor(bank.choice / choice) : Infinity, open ? Math.floor(bank.open / open) : Infinity)
    : 0;
  const warnings: string[] = [];
  if (bank) {
    if (choice > bank.choice) warnings.push(`В банке только ${bank.choice} закрытых — недостающие ${choice - bank.choice} заменятся открытыми, если они есть.`);
    if (open > bank.open) warnings.push(`В банке только ${bank.open} открытых — недостающие ${open - bank.open} заменятся закрытыми, если они есть.`);
    if (total > bank.total) warnings.push(`Всего в банке ${bank.total} вопросов — в тесте будет ${bank.total}, а не ${total}.`);
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Состав тестов</h1>
      <p className="muted small" style={{ marginTop: -8 }}>
        Для каждого уровня: сколько вопросов получает сотрудник и сколько из них закрытых (с вариантами ответа) и открытых. Вопросы каждый раз выбираются
        случайно из всего банка уровня — у разных сотрудников разные комбинации. При повторном прохождении сначала даются вопросы, которых сотрудник ещё не
        видел. Время, попытки и минуты на открытый вопрос — на «Обзоре».
      </p>

      <div className="tabs" style={{ flexWrap: "wrap" }}>
        {LEVELS.map((l) => (
          <button key={l.id} className={level === l.id ? "active" : ""} onClick={() => { setLevel(l.id); setMsg(null); }}>
            {l.icon} {l.id === "EXAM" ? "Итоговый экзамен" : l.label}
          </button>
        ))}
      </div>

      <div className="card stack">
        <div className="row between">
          <h2 style={{ margin: 0 }}>
            {info.icon} {info.id === "EXAM" ? "Итоговый экзамен" : info.label}
          </h2>
          <Link href="/admin/questions" className="btn btn-ghost btn-sm">
            Банк вопросов →
          </Link>
        </div>

        <div className="grid grid-4">
          {[
            ["В банке всего", bank?.total],
            ["Закрытых (с вариантами)", bank?.choice],
            ["Открытых", bank?.open],
          ].map(([label, v]) => (
            <div key={label as string} className="card center" style={{ padding: 16 }}>
              <div style={{ fontSize: 34, fontWeight: 900 }}>{v ?? "…"}</div>
              <div className="muted small">{label}</div>
            </div>
          ))}
        </div>

        <div style={{ fontWeight: 800 }}>Сотрудник получает в тесте:</div>
        <div className="row" style={{ gap: 16, alignItems: "flex-end" }}>
          <label className="field" style={{ margin: 0 }}>
            <span>Закрытых</span>
            <input className="input" style={{ width: 110 }} inputMode="numeric" value={cur.choice} disabled={!isSuper} onChange={(e) => set("choice", e.target.value)} aria-label="Закрытых в тесте" />
          </label>
          <span style={{ fontSize: 28, fontWeight: 900, paddingBottom: 10 }}>+</span>
          <label className="field" style={{ margin: 0 }}>
            <span>Открытых</span>
            <input className="input" style={{ width: 110 }} inputMode="numeric" value={cur.open} disabled={!isSuper} onChange={(e) => set("open", e.target.value)} aria-label="Открытых в тесте" />
          </label>
          <span style={{ fontSize: 28, fontWeight: 900, paddingBottom: 10 }}>=</span>
          <div style={{ paddingBottom: 6 }}>
            <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{total}</div>
            <div className="muted small">вопросов в тесте</div>
          </div>
        </div>

        {bank && total > 0 && (
          <div className="small">
            {runs === Infinity || runs >= 1 ? (
              <>
                🔀 Без единого повтора сотрудник сможет пройти этот тест примерно <strong>{runs === Infinity ? "∞" : runs}</strong> раз(а); дальше будут
                попадаться вопросы, которые он видел реже всего.
              </>
            ) : (
              <>🔀 Вопросов в банке меньше, чем в тесте, — при повторе вопросы будут повторяться. Добавьте вопросы в банк.</>
            )}
          </div>
        )}
        {warnings.map((w) => (
          <div key={w} className="alert alert-error small" style={{ margin: 0 }}>
            ⚠️ {w}
          </div>
        ))}

        {isSuper ? (
          <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={save}>
            Сохранить для уровня «{info.id === "EXAM" ? "Итоговый экзамен" : info.label}»
          </button>
        ) : (
          <p className="muted small">Изменять состав тестов может только суперадминистратор.</p>
        )}
        {msg && <div className={`alert ${msg.ok ? "alert-success" : "alert-error"}`}>{msg.text}</div>}
      </div>
    </div>
  );
}
