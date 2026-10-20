// Презентации: PDF открывается прямо в браузере, PowerPoint — через просмотрщик Microsoft Office.
// Большие файлы и PowerPoint хранятся в Vercel Blob (подключение даёт BLOB_STORE_ID или BLOB_READ_WRITE_TOKEN):
// браузер шлёт файл на сайт частями по CHUNK_BYTES (лимит запроса Vercel ~4,5 МБ), сайт собирает и кладёт в Blob.

export const PRESENTATION_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
};
export const MAX_PRESENTATION_MB = 100;
export const CHUNK_BYTES = 3 * 1024 * 1024;

export const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
export const isPowerPoint = (name: string) => ["ppt", "pptx"].includes(extOf(name));

// Адрес для просмотра на сайте (iframe) и для «Открыть в новой вкладке».
export function viewerUrl(p: { id: string; url: string | null; fileName: string }) {
  if (!p.url) return `/api/learning/presentations/${p.id}`;
  return isPowerPoint(p.fileName) ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(p.url)}` : p.url;
}
