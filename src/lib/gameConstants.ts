// Параметры игр без серверных зависимостей — их используют и страницы в браузере.

// «Грамотность»: секунд на вопрос и вопросов в раунде.
export const LANGUAGE_SECONDS = 10;
export const LANGUAGE_ROUND = 10;
export const GAME_LANGUAGES = ["ru", "uz"] as const;
export type GameLanguage = (typeof GAME_LANGUAGES)[number];
export const isGameLanguage = (l: unknown): l is GameLanguage => GAME_LANGUAGES.includes(l as GameLanguage);
