// Параметры игр без серверных зависимостей — их используют и страницы в браузере.

// «Грамотность»: секунд на вопрос и вопросов в раунде.
export const LANGUAGE_SECONDS = 10;
export const LANGUAGE_ROUND = 10;
export const GAME_LANGUAGES = ["ru", "uz"] as const;
export type GameLanguage = (typeof GAME_LANGUAGES)[number];
export const isGameLanguage = (l: unknown): l is GameLanguage => GAME_LANGUAGES.includes(l as GameLanguage);

// «Можно или нельзя?»: секунд на одну фразу.
export const TRUE_FALSE_SECONDS = 10;
// «Найди и исправь ошибку»: секунд на одно задание (1,5 минуты).
export const FIX_ERROR_SECONDS = 90;

// «1:30» для таймера, «10» — если меньше минуты.
export const formatGameTime = (sec: number) => {
  const s = Math.max(sec, 0);
  return s < 60 ? String(s) : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
