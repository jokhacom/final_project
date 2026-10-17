// Большие документы (Редполитика, книги) ИИ читает по частям: каждая часть
// разбирается отдельным запросом, а темы из разных частей потом объединяются.
// Режем по абзацам, чтобы не разрывать правило посередине.
// ~8000 символов ≈ 4 страницы: ответ ИИ по такой части короткий и успевает за 60 с.
export const CHUNK_CHARS = 8000;

export function splitIntoChunks(text: string, size = CHUNK_CHARS): string[] {
  const paragraphs = text.replace(/\r/g, "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const p of paragraphs) {
    if (p.length > size) {
      // Очень длинный абзац (например, PDF без пустых строк) — режем по предложениям/строкам.
      push();
      const pieces = p.match(new RegExp(`[\\s\\S]{1,${size}}(?=\\s|$)`, "g")) ?? [p];
      pieces.slice(0, -1).forEach((piece) => chunks.push(piece.trim()));
      current = pieces[pieces.length - 1];
      continue;
    }
    if (current.length + p.length + 2 > size) push();
    current += (current ? "\n\n" : "") + p;
  }
  push();
  return chunks;
}
