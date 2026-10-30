// Золотая тема для премиум-сотрудников (только в браузере).
// premiumGold в localStorage — чтобы тема включалась сразу при загрузке, без мигания (см. themeInitScript);
// premiumTheme = "off" — сотрудник выключил золотую тему в кабинете.
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

export const goldThemeEnabled = () => read("premiumTheme") !== "off";

// Включить или убрать золотую тему по тому, есть ли сейчас премиум и не выключил ли её сотрудник.
export function applyGoldTheme(premium: boolean) {
  const on = premium && goldThemeEnabled();
  if (on) document.documentElement.dataset.premium = "gold";
  else delete document.documentElement.dataset.premium;
  write("premiumGold", on ? "1" : "0");
}

export function setGoldThemeEnabled(enabled: boolean) {
  write("premiumTheme", enabled ? "on" : "off");
  applyGoldTheme(true);
}
