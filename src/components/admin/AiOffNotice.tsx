import type { AdminStatus } from "./useAdminStatus";

// Подсказка, что функции ИИ появятся после добавления ключа.
export function AiOffNotice({ ai }: { ai: AdminStatus["ai"] }) {
  if (ai.configured) return null;
  return (
    <div className="alert" style={{ background: "var(--surface)", border: "1px dashed var(--border)", color: "var(--muted)" }}>
      🤖 ИИ пока не подключён — анализ документов и генерация вопросов станут доступны после того, как вы добавите{" "}
      <code>{ai.keyEnv}</code> в переменные окружения Vercel и сделаете Redeploy. Сейчас вопросы добавляются вручную или импортом из Excel, а ответы
      проверяются по ключевым словам.
    </div>
  );
}
