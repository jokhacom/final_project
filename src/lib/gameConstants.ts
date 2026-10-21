// Параметры игр без серверных зависимостей — их используют и страницы в браузере.

// «Грамотность»: вопросов в раунде.
export const LANGUAGE_ROUND = 10;

// Таймеры игр по умолчанию, секунд на один ответ; суперадмин меняет их на «Обзоре» (Setting "game_seconds_<ИГРА>").
export const GAME_TIMER_DEFAULTS = { TRUE_FALSE: 10, FIX_ERROR: 90, LANGUAGE: 10 } as const;
export type GameTimerKind = keyof typeof GAME_TIMER_DEFAULTS;
export const GAME_LANGUAGES = ["ru", "uz"] as const;
export type GameLanguage = (typeof GAME_LANGUAGES)[number];
export const isGameLanguage = (l: unknown): l is GameLanguage => GAME_LANGUAGES.includes(l as GameLanguage);
