import JSZip from "jszip";
import { extractText } from "./extractText";
import { extOf } from "../presentations";

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : XML_ENTITIES[e] ?? m
  );

// Текст из XML слайда PowerPoint: абзацы <a:p>, внутри — фрагменты <a:t>.
function slideXmlText(xml: string) {
  return (xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) ?? [])
    .map((p) => (p.match(/<a:t>([\s\S]*?)<\/a:t>/g) ?? []).map((t) => decodeXml(t.replace(/<\/?a:t>/g, ""))).join(""))
    .filter((line) => line.trim())
    .join("\n");
}

// .pptx — это zip: слайды ppt/slides/slideN.xml, заметки докладчика ppt/notesSlides/notesSlideN.xml.
async function pptxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const num = (name: string) => Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0);
  const files = (dir: string) =>
    Object.keys(zip.files)
      .filter((n) => new RegExp(`^ppt/${dir}/\\w+?\\d+\\.xml$`).test(n))
      .sort((a, b) => num(a) - num(b));
  const notes = new Map<number, string>();
  for (const n of files("notesSlides")) {
    // В заметках есть и номер слайда — отбрасываем строки из одних цифр.
    const text = slideXmlText(await zip.file(n)!.async("string"))
      .split("\n")
      .filter((l) => !/^\d+$/.test(l.trim()))
      .join("\n");
    if (text) notes.set(num(n), text);
  }
  const slides: string[] = [];
  for (const n of files("slides")) {
    const text = slideXmlText(await zip.file(n)!.async("string"));
    const note = notes.get(num(n));
    if (text || note) slides.push(`Слайд ${num(n)}:\n${text}${note ? `\nЗаметки: ${note}` : ""}`);
  }
  return slides.join("\n\n");
}

// Текст презентации для «Помощника ответов». PDF и .pptx; старый .ppt не читаем — вернём "".
export async function presentationText(buffer: Buffer, fileName: string): Promise<string> {
  const ext = extOf(fileName);
  if (ext === "pdf") return (await extractText(buffer, "pdf")).trim();
  if (ext === "pptx") return (await pptxText(buffer)).trim();
  return "";
}

// Безопасный вариант для загрузки: ошибка чтения текста не должна мешать сохранить презентацию.
export async function presentationTextSafe(buffer: Buffer, fileName: string) {
  try {
    return await presentationText(buffer, fileName);
  } catch (e) {
    console.error("presentation text failed:", fileName, e);
    return "";
  }
}
