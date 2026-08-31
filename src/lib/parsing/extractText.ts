import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// Извлекает читаемый текст из загруженного файла, независимо от формата.
// Результат сохраняется в Material.content и оттуда идёт в aiProvider.generateQuestions.
// Добавление нового формата (например .pptx) = один новый case здесь,
// остальной пайплайн (upload → generate) не меняется.
export async function extractText(buffer: Buffer, type: "pdf" | "docx" | "txt"): Promise<string> {
  switch (type) {
    case "pdf": {
      const result = await pdfParse(buffer);
      return result.text;
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "txt": {
      return buffer.toString("utf-8");
    }
    default:
      throw new Error(`Unsupported file type: ${type}`);
  }
}

// Простая защита: очень длинные документы режем, чтобы не превышать контекст модели.
// Для реально больших регламентов в будущем — разбивать на чанки и обрабатывать по частям.
export function truncateForAI(text: string, maxChars = 12000): string {
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}
