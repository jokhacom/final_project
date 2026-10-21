import { db } from "./db";

// Сколько сотрудников может быть на сайте (Setting "max_employees").
// 0 — без ограничений. Администраторов лимит не касается: считаются только EMPLOYEE.
export const USER_LIMIT_KEY = "max_employees";

export const isValidUserLimit = (n: number) => Number.isInteger(n) && n >= 0;

export async function getUserLimit(): Promise<number> {
  const s = await db.setting.findUnique({ where: { key: USER_LIMIT_KEY } });
  const n = Number(s?.value);
  return isValidUserLimit(n) ? n : 0;
}

// Можно ли зарегистрировать ещё одного сотрудника.
export async function canRegisterEmployee(): Promise<boolean> {
  const limit = await getUserLimit();
  if (!limit) return true;
  const count = await db.user.count({ where: { role: "EMPLOYEE" } });
  return count < limit;
}
