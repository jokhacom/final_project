"use client";

import { useEffect, useState } from "react";

// Переключатель тёмной/светлой темы. Выбор хранится в localStorage,
// начальная тема ставится скриптом в layout.tsx до отрисовки (без мигания).
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <button className="icon-btn" onClick={toggle} title="Сменить тему" aria-label="Сменить тему">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

// premiumGold — золотая тема премиума (см. lib/premiumTheme.ts); Header потом сверяет её с сервером.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");document.documentElement.dataset.theme=t==="light"?"light":"dark";if(localStorage.getItem("premiumGold")==="1")document.documentElement.dataset.premium="gold";}catch(e){document.documentElement.dataset.theme="dark";}})();`;
