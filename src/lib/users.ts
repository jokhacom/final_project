import { SUPERADMIN_USERNAME } from "./auth";
import { USERNAME_RE } from "./usernameRule";

// Правила для нового пользователя — общие для самостоятельной регистрации и для создания администратором.
export { USERNAME_RE };
export const USERNAME_RULE = "Логин: 3–32 символа — латинские буквы, цифры, точка, дефис или подчёркивание (без @, пробелов и запятых). Например: nigora.k";
export const MIN_PASSWORD = 6;

export function validateNewUser(name: unknown, username: unknown, password: unknown): string | null {
  const n = String(name ?? "").trim(), u = String(username ?? "").trim(), p = String(password ?? "");
  if (!n || !u || !p) return "Заполните имя, логин и пароль";
  if (!USERNAME_RE.test(u)) return u.includes("@") ? "Логин — это не почта: уберите @ и всё, что после него. " + USERNAME_RULE : USERNAME_RULE;
  if (p.length < MIN_PASSWORD) return `Пароль должен быть не короче ${MIN_PASSWORD} символов`;
  if (u.toLowerCase() === SUPERADMIN_USERNAME.toLowerCase()) return "Этот логин зарезервирован";
  return null;
}
