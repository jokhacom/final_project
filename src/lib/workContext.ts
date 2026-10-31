import { db } from "./db";
import { DEFAULT_WORK_CONTEXT, WORK_CONTEXT_KEY } from "./workContextText";

export * from "./workContextText";

export async function getWorkContext() {
  const s = await db.setting.findUnique({ where: { key: WORK_CONTEXT_KEY } }).catch(() => null);
  return s?.value?.trim() || DEFAULT_WORK_CONTEXT;
}
